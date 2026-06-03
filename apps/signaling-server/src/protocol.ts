import type { SignalMessage } from "@uos/shared";

export function validateMessage(data: unknown): SignalMessage | null {
  if (typeof data !== "object" || data === null) return null;

  const msg = data as Record<string, unknown>;

  if (typeof msg.type !== "string") return null;

  const validTypes = [
    "create-room",
    "join-room",
    "leave",
    "offer",
    "answer",
    "ice-candidate",
  ];

  if (!validTypes.includes(msg.type)) return null;

  if (msg.type === "create-room") {
    if (msg.role !== "host") return null;
    if (typeof msg.peerId !== "string" || msg.peerId.length === 0) return null;
  }

  if (msg.type === "join-room") {
    if (msg.role !== "viewer") return null;
    if (typeof msg.roomId !== "string" || !/^[0-9]{6}$/.test(msg.roomId)) return null;
    if (typeof msg.peerId !== "string" || msg.peerId.length === 0) return null;
  }

  if (msg.type === "leave") {
    if (typeof msg.roomId !== "string") return null;
    if (typeof msg.peerId !== "string") return null;
  }

  if (msg.type === "offer" || msg.type === "answer") {
    if (typeof msg.roomId !== "string") return null;
    if (typeof msg.fromPeerId !== "string") return null;
    if (typeof msg.toPeerId !== "string") return null;
    if (typeof msg.sdp !== "object" || msg.sdp === null) return null;
  }

  if (msg.type === "ice-candidate") {
    if (typeof msg.roomId !== "string") return null;
    if (typeof msg.fromPeerId !== "string") return null;
    if (typeof msg.toPeerId !== "string") return null;
    if (typeof msg.candidate !== "object" || msg.candidate === null) return null;
  }

  return msg as unknown as SignalMessage;
}

export function isValidWebSocketMessage(
  data: Buffer | string,
  maxSize: number = 64 * 1024,
): boolean {
  const length = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
  if (length > maxSize) {
    return false;
  }
  return true;
}
