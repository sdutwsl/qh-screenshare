import type { SignalMessage } from "@uos/shared";
import { SIGNALING_PATH, logger } from "@uos/shared";

export type SignalingEvent =
  | { type: "connected" }
  | { type: "disconnected" }
  | { type: "error"; code: string; message: string }
  | { type: "message"; message: SignalMessage };

export type SignalingEventHandler = (event: SignalingEvent) => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: Set<SignalingEventHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 3000;
  private peerId: string | null = null;

  constructor(serverUrl: string) {
    const wsUrl = serverUrl.replace(/^http/, "ws").replace(/\/$/, "");
    if (wsUrl.endsWith(SIGNALING_PATH)) {
      this.url = wsUrl;
    } else {
      this.url = `${wsUrl}${SIGNALING_PATH}`;
    }
  }

  connect(peerId: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    this.peerId = peerId;

    try {
      this.ws = new WebSocket(this.url);
    } catch (err) {
      logger.error("Failed to create WebSocket", { peerId });
      this.notifyHandlers({
        type: "error",
        code: "WS_CREATE_FAILED",
        message: "Failed to create WebSocket connection",
      });
      return;
    }

    this.ws.onopen = () => {
      logger.info("Signaling connected", { peerId });
      this.reconnectAttempts = 0;
      this.notifyHandlers({ type: "connected" });
    };

    this.ws.onmessage = (event: MessageEvent) => {
      let data: unknown;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        logger.error("Failed to parse signaling message", { peerId });
        return;
      }

      const msg = data as SignalMessage;
      if (msg.type && msg.type !== "offer" && msg.type !== "answer") {
        logger.debug(`Signaling recv: ${msg.type}`, {
          roomId: msg.roomId,
          peerId: this.peerId ?? undefined,
        });
      }

      this.notifyHandlers({ type: "message", message: msg });
    };

    this.ws.onclose = () => {
      logger.info("Signaling disconnected", { peerId });
      this.notifyHandlers({ type: "disconnected" });
      this.attemptReconnect();
    };

    this.ws.onerror = () => {
      logger.error("WebSocket error", { peerId });
      this.notifyHandlers({
        type: "error",
        code: "WS_ERROR",
        message: "WebSocket connection error",
      });
    };
  }

  send(msg: SignalMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onEvent(handler: SignalingEventHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  getIsConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    logger.info(`Reconnect attempt ${this.reconnectAttempts}`, {
      peerId: this.peerId ?? undefined,
    });
    setTimeout(() => {
      if (this.peerId) {
        this.connect(this.peerId);
      }
    }, this.reconnectDelay);
  }

  private notifyHandlers(event: SignalingEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (err) {
        logger.error("Signaling event handler error");
      }
    }
  }
}
