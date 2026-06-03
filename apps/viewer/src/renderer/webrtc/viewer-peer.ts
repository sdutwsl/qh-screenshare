import {
  DEFAULT_RTC_CONFIG,
  type RtcConfig,
  type SignalMessage,
} from "@uos/shared";
import type { SignalingClient } from "./signaling-client";

export interface ViewerPeerCallbacks {
  onRemoteStream: (stream: MediaStream) => void;
  onStatusChange: (status: string) => void;
  onDisconnected: () => void;
  onError: (code: string, message: string) => void;
}

function parseIceServers(): RtcConfig {
  try {
    const envVal = import.meta.env.VITE_RTC_ICE_SERVERS;
    if (envVal) {
      const parsed = JSON.parse(envVal);
      if (parsed && Array.isArray(parsed)) {
        return { iceServers: parsed };
      }
    }
  } catch {
    // fall through to default
  }
  try {
    const envVal = import.meta.env.VITE_ICE_SERVERS;
    if (envVal) {
      const parsed = JSON.parse(envVal);
      if (parsed && Array.isArray(parsed)) {
        return { iceServers: parsed };
      }
    }
  } catch {
    // fall through to default
  }
  return { ...DEFAULT_RTC_CONFIG };
}

export class ViewerPeer {
  private pc: RTCPeerConnection | null = null;
  private signaling: SignalingClient;
  private callbacks: ViewerPeerCallbacks;
  private roomId: string;
  private peerId: string;
  private hostPeerId: string | null = null;
  private rtcConfig: RtcConfig;

  constructor(
    signaling: SignalingClient,
    callbacks: ViewerPeerCallbacks,
    roomId: string,
    peerId: string,
  ) {
    this.signaling = signaling;
    this.callbacks = callbacks;
    this.roomId = roomId;
    this.peerId = peerId;
    this.rtcConfig = parseIceServers();
  }

  async handleSignal(msg: SignalMessage): Promise<void> {
    switch (msg.type) {
      case "offer": {
        if (msg.fromPeerId && msg.toPeerId === this.peerId && msg.sdp) {
          this.hostPeerId = msg.fromPeerId;
          await this.handleOffer(msg.sdp);
        }
        break;
      }

      case "ice-candidate": {
        if (msg.fromPeerId === this.hostPeerId && msg.toPeerId === this.peerId && msg.candidate) {
          await this.addIceCandidate(msg.candidate);
        }
        break;
      }

      case "leave": {
        this.callbacks.onStatusChange("Host已断开");
        this.callbacks.onDisconnected();
        this.close();
        break;
      }

      case "viewer-accepted":
      case "room-created":
      case "viewer-joined":
        break;
    }
  }

  private async handleOffer(
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    try {
      this.pc = new RTCPeerConnection(this.rtcConfig);

      this.pc.ontrack = (event: RTCTrackEvent) => {
        this.callbacks.onStatusChange("已连接");
        this.callbacks.onRemoteStream(event.streams[0]);
      };

      this.pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate && this.hostPeerId) {
          this.signaling.send({
            type: "ice-candidate",
            roomId: this.roomId,
            fromPeerId: this.peerId,
            toPeerId: this.hostPeerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        const state = this.pc?.iceConnectionState;
        if (state === "disconnected" || state === "failed") {
          this.callbacks.onStatusChange(`连接状态: ${state}`);
        }
      };

      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState;
        if (state === "failed" || state === "disconnected") {
          this.callbacks.onError("CONNECTION_FAILED", `WebRTC连接失败: ${state}`);
        }
      };

      await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));

      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);

      this.callbacks.onStatusChange("等待ICE连接...");

      if (this.hostPeerId) {
        this.signaling.send({
          type: "answer",
          roomId: this.roomId,
          fromPeerId: this.peerId,
          toPeerId: this.hostPeerId,
          sdp: this.pc.localDescription!.toJSON(),
        });
      }
    } catch (err) {
      this.callbacks.onError(
        "WEBRTC_ERROR",
        `WebRTC连接失败: ${(err as Error).message}`,
      );
      this.callbacks.onDisconnected();
      this.close();
    }
  }

  private async addIceCandidate(
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error("Failed to add ICE candidate:", err);
    }
  }

  close(): void {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.hostPeerId = null;
  }
}
