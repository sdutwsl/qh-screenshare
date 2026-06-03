import { randomUUID } from "@uos/shared";
import { SignalingClient } from "./webrtc/signaling-client";
import { ViewerPeer } from "./webrtc/viewer-peer";

declare global {
  interface Window {
    viewerAPI?: {
      getAppConfig: () => Promise<{
        signalingUrl: string;
      }>;
    };
  }
}

let signalingUrl = "ws://localhost:3000";

let signaling: SignalingClient | null = null;
let viewerPeer: ViewerPeer | null = null;
let peerId: string | null = null;

const roomInput = document.getElementById("room-id-input") as HTMLInputElement;
const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;
const disconnectBtn = document.getElementById(
  "disconnect-btn",
) as HTMLButtonElement;
const statusText = document.getElementById("status-text")!;
const errorArea = document.getElementById("error-area")!;
const remoteVideo = document.getElementById(
  "remote-video",
) as HTMLVideoElement;
const videoPlaceholder = document.getElementById("video-placeholder")!;

function setStatus(text: string, state: "connecting" | "connected" | "disconnected"): void {
  statusText.textContent = text;
  statusText.className = state;
}

function showError(message: string): void {
  errorArea.textContent = message;
  errorArea.classList.remove("hidden");
}

function hideError(): void {
  errorArea.textContent = "";
  errorArea.classList.add("hidden");
}

function cleanupVideo(): void {
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject = null;
  }
  remoteVideo.classList.remove("active");
  videoPlaceholder.classList.remove("hidden");
}

function cleanupResources(keepError: boolean = false): void {
  if (viewerPeer) {
    viewerPeer.close();
    viewerPeer = null;
  }
  if (signaling) {
    signaling.disconnect();
    signaling = null;
  }
  cleanupVideo();
  if (!keepError) {
    hideError();
  }
  updateUI(false);
}

function getSignalingUrl(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const serverFromParam = urlParams.get("server");
  if (serverFromParam) {
    return serverFromParam.replace(/^http/, "ws");
  }
  return signalingUrl.replace(/^http/, "ws");
}

async function loadConfig(): Promise<void> {
  if (window.viewerAPI) {
    try {
      const config = await window.viewerAPI.getAppConfig();
      signalingUrl = config.signalingUrl;
    } catch {
      // keep default
    }
  }
}

connectBtn.addEventListener("click", () => {
  const roomId = roomInput.value.trim();
  if (!/^[0-9]{6}$/.test(roomId)) {
    showError("请输入有效的6位数字房间号");
    return;
  }

  startConnection(roomId);
});

disconnectBtn.addEventListener("click", () => {
  disconnect();
});

roomInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    connectBtn.click();
  }
});

async function startConnection(roomId: string): Promise<void> {
  hideError();
  setStatus("连接中...", "connecting");

  peerId = randomUUID();

  signaling = new SignalingClient(getSignalingUrl());
  signaling.onEvent((event) => {
    switch (event.type) {
      case "connected":
        signaling!.send({
          type: "join-room",
          role: "viewer",
          roomId,
          peerId: peerId!,
        });
        break;

      case "disconnected":
        setStatus("已断开", "disconnected");
        cleanupResources(false);
        break;

      case "error":
        showError(event.message);
        setStatus("错误", "disconnected");
        cleanupResources(true);
        break;

      case "message":
        if (event.message.type === "error") {
          showError(event.message.message);
          setStatus("错误", "disconnected");
          cleanupResources(true);
        } else {
          viewerPeer?.handleSignal(event.message);
        }
        break;
    }
  });

  viewerPeer = new ViewerPeer(
    signaling,
    {
      onRemoteStream: (stream: MediaStream) => {
        remoteVideo.srcObject = stream;
        remoteVideo.classList.add("active");
        videoPlaceholder.classList.add("hidden");
        remoteVideo.play().catch(() => {
          showError("浏览器阻止自动播放，请点击播放按钮");
        });
      },
      onStatusChange: (status: string) => {
        setStatus(status, "connected");
      },
      onDisconnected: () => {
        cleanupVideo();
        setStatus("已断开", "disconnected");
        updateUI(false);
        if (signaling) {
          signaling.disconnect();
          signaling = null;
        }
      },
      onError: (code: string, message: string) => {
        showError(`[${code}] ${message}`);
      },
    },
    roomId,
    peerId,
  );

  signaling.connect(peerId);
  updateUI(true);
}

function disconnect(): void {
  if (signaling) {
    if (signaling.getIsConnected() && peerId) {
      signaling.send({
        type: "leave",
        roomId: roomInput.value.trim(),
        peerId,
      });
    }
  }

  cleanupResources(false);

  peerId = null;
  setStatus("未连接", "disconnected");
}

function updateUI(connected: boolean): void {
  connectBtn.disabled = connected;
  disconnectBtn.disabled = !connected;
  roomInput.disabled = connected;
}

function getRoomIdFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  if (room && /^[0-9]{6}$/.test(room)) {
    return room;
  }
  return null;
}

const queryRoom = getRoomIdFromQuery();
if (queryRoom) {
  roomInput.value = queryRoom;
}

loadConfig();
