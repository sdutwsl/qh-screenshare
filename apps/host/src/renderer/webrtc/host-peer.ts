import {
  DEFAULT_RTC_CONFIG,
  type RtcConfig,
  type SignalMessage,
} from "@uos/shared";
import { logger } from "@uos/shared";
import type { SignalingClient } from "./signaling-client";

export interface HostPeerCallbacks {
  onStatusChange: (status: string) => void;
  onViewerJoined: (viewerPeerId: string) => void;
  onViewerLeft: (viewerPeerId: string) => void;
  onError: (code: string, message: string) => void;
}

interface ViewerConnection {
  peerId: string;
  pc: RTCPeerConnection;
}

function parseIceServers(): RtcConfig {
  return { ...DEFAULT_RTC_CONFIG };
}

export class HostPeer {
  private signaling: SignalingClient;
  private callbacks: HostPeerCallbacks;
  private roomId: string;
  private hostPeerId: string;
  private mediaStream: MediaStream | null = null;
  private viewers: Map<string, ViewerConnection> = new Map();
  private rtcConfig: RtcConfig;

  constructor(
    signaling: SignalingClient,
    callbacks: HostPeerCallbacks,
    roomId: string,
    hostPeerId: string,
  ) {
    this.signaling = signaling;
    this.callbacks = callbacks;
    this.roomId = roomId;
    this.hostPeerId = hostPeerId;
    this.rtcConfig = parseIceServers();
  }

  setMediaStream(stream: MediaStream): void {
    this.mediaStream = stream;

    for (const [viewerId, conn] of this.viewers) {
      this.addTracksToConnection(stream, conn.pc);
      this.negotiateConnection(viewerId, conn.pc);
    }
  }

  handleSignal(msg: SignalMessage): void {
    switch (msg.type) {
      case "viewer-joined": {
        if (msg.viewerPeerId) {
          this.onViewerJoined(msg.viewerPeerId);
        }
        break;
      }

      case "answer": {
        if (msg.fromPeerId && msg.toPeerId === this.hostPeerId && msg.sdp) {
          this.handleAnswer(msg.fromPeerId, msg.sdp);
        }
        break;
      }

      case "ice-candidate": {
        if (msg.fromPeerId && msg.toPeerId === this.hostPeerId && msg.candidate) {
          this.handleIceCandidate(msg.fromPeerId, msg.candidate);
        }
        break;
      }

      case "leave": {
        if (msg.peerId) {
          this.removeViewer(msg.peerId);
        }
        break;
      }
    }
  }

  private addTracksToConnection(
    stream: MediaStream,
    pc: RTCPeerConnection,
  ): void {
    for (const track of stream.getVideoTracks()) {
      pc.addTrack(track, stream);
    }
  }

  private onViewerJoined(viewerPeerId: string): void {
    const pc = new RTCPeerConnection(this.rtcConfig);

    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        this.signaling.send({
          type: "ice-candidate",
          roomId: this.roomId,
          fromPeerId: this.hostPeerId,
          toPeerId: viewerPeerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      logger.debug(`ICE state [${viewerPeerId}]: ${pc.iceConnectionState}`, {
        roomId: this.roomId,
      });
    };

    this.viewers.set(viewerPeerId, { peerId: viewerPeerId, pc });
    this.callbacks.onViewerJoined(viewerPeerId);

    if (this.mediaStream) {
      this.addTracksToConnection(this.mediaStream, pc);
    }

    this.negotiateConnection(viewerPeerId, pc);
  }

  private async negotiateConnection(
    viewerPeerId: string,
    pc: RTCPeerConnection,
  ): Promise<void> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      this.signaling.send({
        type: "offer",
        roomId: this.roomId,
        fromPeerId: this.hostPeerId,
        toPeerId: viewerPeerId,
        sdp: pc.localDescription!.toJSON(),
      });
    } catch (err) {
      logger.error(`Failed to create offer for ${viewerPeerId}`, {
        roomId: this.roomId,
      });
      this.callbacks.onError("OFFER_FAILED", "Failed to create WebRTC offer");
    }
  }

  private async handleAnswer(
    viewerPeerId: string,
    sdp: RTCSessionDescriptionInit,
  ): Promise<void> {
    const conn = this.viewers.get(viewerPeerId);
    if (!conn) return;

    try {
      await conn.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      logger.error(`Failed to set remote description for ${viewerPeerId}`, {
        roomId: this.roomId,
      });
    }
  }

  private async handleIceCandidate(
    viewerPeerId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const conn = this.viewers.get(viewerPeerId);
    if (!conn) return;

    try {
      await conn.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      logger.error(`Failed to add ICE candidate from ${viewerPeerId}`, {
        roomId: this.roomId,
      });
    }
  }

  private removeViewer(viewerPeerId: string): void {
    const conn = this.viewers.get(viewerPeerId);
    if (conn) {
      conn.pc.close();
      this.viewers.delete(viewerPeerId);
      this.callbacks.onViewerLeft(viewerPeerId);
    }
  }

  closeAll(): void {
    for (const [, conn] of this.viewers) {
      conn.pc.close();
    }
    this.viewers.clear();

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
  }

  getViewerCount(): number {
    return this.viewers.size;
  }
}
