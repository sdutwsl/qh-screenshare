import { randomUUID } from "@uos/shared";
import { SignalingClient } from "./webrtc/signaling-client";
import { HostPeer } from "./webrtc/host-peer";
import { stateManager } from "./ui/state";

declare global {
  interface Window {
    hostAPI: {
      getRuntimeInfo: () => Promise<{
        xdgSessionType: string;
        display: string;
        waylandDisplay: string;
        xdgCurrentDesktop: string;
        desktopSession: string;
        platform: string;
        arch: string;
        electronVersion: string;
        nodeVersion: string;
      }>;
      getAppConfig: () => Promise<{
        signalingUrl: string;
        viewerPublicUrl: string;
      }>;
    };
  }
}

let signalingUrl = import.meta.env.VITE_SIGNALING_URL || "ws://localhost:3000";
let viewerPublicUrl = import.meta.env.VITE_VIEWER_PUBLIC_URL || "http://localhost:5174";

let signaling: SignalingClient | null = null;
let hostPeer: HostPeer | null = null;
let hostPeerId: string | null = null;
let mediaStream: MediaStream | null = null;

const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const stopBtn = document.getElementById("stop-btn") as HTMLButtonElement;
const statusText = document.getElementById("status-text")!;
const errorArea = document.getElementById("error-area")!;
const roomIdDisplay = document.getElementById("room-id-display")!;
const viewerUrlDisplay = document.getElementById("viewer-url")!;
const viewerCountDisplay = document.getElementById("viewer-count")!;
const roomInfoBox = document.getElementById("room-info")!;
const previewArea = document.getElementById("preview-area")!;
const localPreview = document.getElementById(
  "local-preview",
) as HTMLVideoElement;
const waylandNotice = document.getElementById("wayland-notice")!;

const envSessionType = document.getElementById("env-session-type")!;
const envDesktop = document.getElementById("env-desktop")!;
const envDisplay = document.getElementById("env-display")!;
const envWayland = document.getElementById("env-wayland")!;
const signalingUrlDisplay = document.getElementById("signaling-url-display")!;

function setStatus(text: string, type: "connected" | "disconnected" | "error"): void {
  statusText.textContent = text;
  statusText.className = type;
  stateManager.setState({ statusText: text, statusType: type });
}

function showError(message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove("hidden");
}

function hideError(): void {
  errorArea.classList.add("hidden");
}

startBtn.addEventListener("click", () => {
  startSharing();
});

stopBtn.addEventListener("click", () => {
  stopSharing();
});

async function loadEnvInfo(): Promise<void> {
  if (window.hostAPI) {
    try {
      const config = await window.hostAPI.getAppConfig();
      signalingUrl = config.signalingUrl;
      viewerPublicUrl = config.viewerPublicUrl;
    } catch {
      // keep defaults
    }
  }

  signalingUrlDisplay.textContent = signalingUrl.replace(/\/ws\/?$/, "/ws");

  if (window.hostAPI) {
    try {
      const info = await window.hostAPI.getRuntimeInfo();
      envSessionType.textContent = info.xdgSessionType;
      envDesktop.textContent = info.xdgCurrentDesktop;
      envDisplay.textContent = info.display;
      envWayland.textContent = info.waylandDisplay;

      if (info.xdgSessionType === "wayland") {
        waylandNotice.classList.remove("hidden");
      }

      viewerUrlDisplay.textContent = `${viewerPublicUrl}/?room=`;
    } catch {
      envSessionType.textContent = "unknown";
      envDesktop.textContent = "unknown";
      envDisplay.textContent = "-";
      envWayland.textContent = "-";
    }
  } else {
    envSessionType.textContent = "(浏览器)";
    envDesktop.textContent = "-";
    envDisplay.textContent = "-";
    envWayland.textContent = "-";
  }
}

async function startSharing(): Promise<void> {
  hideError();
  setStatus("获取屏幕...", "disconnected");

  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    setStatus("不支持", "error");
    const hasMediaDevices = Boolean(navigator.mediaDevices);
    const hasGetDisplayMedia = Boolean(navigator.mediaDevices?.getDisplayMedia);
    showError(
      `当前 Electron 环境不支持屏幕共享：mediaDevices=${hasMediaDevices}, getDisplayMedia=${hasGetDisplayMedia}`,
    );
    return;
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30, max: 30 },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  } catch (err) {
    console.error("getDisplayMedia error:", err);
    const e = err as Error;
    if (e.name === "AbortError" || e.message?.includes("cancelled") || e.message?.includes("cancel")) {
      setStatus("用户取消共享", "disconnected");
      showError("用户取消了屏幕选择");
    } else {
      setStatus("获取屏幕失败", "error");
      showError(`获取屏幕失败: ${e.message}`);
    }
    return;
  }

  if (!stream || stream.getVideoTracks().length === 0) {
    setStatus("无可用屏幕源", "error");
    showError("未检测到可用的屏幕源，请确认显示设置");
    return;
  }

  mediaStream = stream;

  stream.getVideoTracks()[0].onended = () => {
    stopSharing();
  };

  localPreview.srcObject = stream;
  previewArea.classList.remove("hidden");

  hostPeerId = randomUUID();

  signaling = new SignalingClient(signalingUrl);

  signaling.onEvent((event) => {
    switch (event.type) {
      case "connected":
        signaling!.send({
          type: "create-room",
          role: "host",
          peerId: hostPeerId!,
        });
        break;

      case "disconnected":
        showError("信令服务器连接断开");
        stopSharing({ keepError: true, statusText: "信令断开", statusType: "error" });
        break;

      case "error":
        showError(event.message);
        stopSharing({ keepError: true, statusText: "错误", statusType: "error" });
        break;

      case "message":
        if (event.message.type === "room-created") {
          handleRoomCreated(event.message.roomId);
        } else if (event.message.type === "error") {
          showError(event.message.message);
          setStatus("错误", "error");
        } else {
          hostPeer?.handleSignal(event.message);
        }
        break;
    }
  });

  signaling.connect(hostPeerId);
}

function handleRoomCreated(roomId: string): void {
  if (!signaling || !hostPeerId) return;

  hostPeer = new HostPeer(
    signaling,
    {
      onStatusChange: (status: string) => {
        setStatus(status, "connected");
      },
      onViewerJoined: () => {
        const count = hostPeer?.getViewerCount() ?? 0;
        viewerCountDisplay.textContent = String(count);
        stateManager.setState({ viewerCount: count });
      },
      onViewerLeft: () => {
        const count = hostPeer?.getViewerCount() ?? 0;
        viewerCountDisplay.textContent = String(count);
        stateManager.setState({ viewerCount: count });
      },
      onError: (code: string, message: string) => {
        showError(`[${code}] ${message}`);
      },
    },
    roomId,
    hostPeerId,
  );

  if (mediaStream) {
    hostPeer.setMediaStream(mediaStream);
  }

  roomIdDisplay.textContent = roomId;
  viewerUrlDisplay.textContent = `${viewerPublicUrl}/?room=${roomId}`;
  viewerCountDisplay.textContent = "0";
  roomInfoBox.classList.remove("hidden");

  setStatus("正在共享", "connected");
  stateManager.setState({ isSharing: true, roomId });

  startBtn.disabled = true;
  startBtn.classList.add("hidden");
  stopBtn.classList.remove("hidden");
  stopBtn.disabled = false;
}

function stopSharing(opts?: { keepError?: boolean; statusText?: string; statusType?: "connected" | "disconnected" | "error" }): void {
  if (signaling) {
    signaling.send({
      type: "leave",
      roomId: stateManager.getState().roomId ?? "",
      peerId: hostPeerId ?? "",
    });
    signaling.disconnect();
    signaling = null;
  }

  if (hostPeer) {
    hostPeer.closeAll();
    hostPeer = null;
  }

  if (mediaStream) {
    for (const track of mediaStream.getTracks()) {
      track.stop();
    }
    mediaStream = null;
  }

  localPreview.srcObject = null;
  previewArea.classList.add("hidden");

  hostPeerId = null;

  roomIdDisplay.textContent = "-";
  viewerUrlDisplay.textContent = `${viewerPublicUrl}/?room=`;
  viewerCountDisplay.textContent = "0";
  roomInfoBox.classList.add("hidden");

  const statusText = opts?.statusText ?? "未共享";
  const statusType = opts?.statusType ?? "disconnected";
  setStatus(statusText, statusType);
  stateManager.setState({ isSharing: false, roomId: null, viewerCount: 0 });

  if (!opts?.keepError) {
    hideError();
  }

  startBtn.disabled = false;
  startBtn.classList.remove("hidden");
  stopBtn.classList.add("hidden");
  stopBtn.disabled = true;
}

loadEnvInfo();
