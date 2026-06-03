import type WebSocket from "ws";
import { generateRoomId, logger } from "@uos/shared";

const MAX_VIEWERS_PER_ROOM_DEFAULT = 4;

export interface Peer {
  ws: WebSocket;
  peerId: string;
  role: "host" | "viewer";
}

export interface Room {
  roomId: string;
  host: Peer | null;
  viewers: Map<string, Peer>;
  maxViewers: number;
}

const roomMap = new Map<string, Room>();
const orphanTimestamps = new Map<string, number>();

export function getMaxViewers(): number {
  return (
    Number(process.env.MAX_VIEWERS_PER_ROOM) || MAX_VIEWERS_PER_ROOM_DEFAULT
  );
}

export function createRoom(hostWs: WebSocket, hostPeerId: string): Room {
  let roomId = generateRoomId();
  let attempts = 0;
  const maxAttempts = 10;
  while (roomMap.has(roomId) && attempts < maxAttempts) {
    roomId = generateRoomId();
    attempts++;
  }
  if (roomMap.has(roomId)) {
    throw new Error("Unable to generate unique room ID");
  }
  const room: Room = {
    roomId,
    host: { ws: hostWs, peerId: hostPeerId, role: "host" },
    viewers: new Map(),
    maxViewers: getMaxViewers(),
  };
  roomMap.set(roomId, room);
  logger.info("Room created", { roomId, peerId: hostPeerId });
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return roomMap.get(roomId);
}

export function addViewerToRoom(
  roomId: string,
  viewerWs: WebSocket,
  viewerPeerId: string,
): { success: true; viewerPeerId: string } | { success: false; error: string } {
  const room = roomMap.get(roomId);
  if (!room) {
    return { success: false, error: "ROOM_NOT_FOUND" };
  }
  if (!room.host) {
    return { success: false, error: "ROOM_HAS_NO_HOST" };
  }
  if (room.viewers.size >= room.maxViewers) {
    return { success: false, error: "ROOM_FULL" };
  }

  const viewerPeer: Peer = { ws: viewerWs, peerId: viewerPeerId, role: "viewer" };
  room.viewers.set(viewerPeerId, viewerPeer);
  orphanTimestamps.delete(roomId);
  logger.info("Viewer joined", { roomId, peerId: viewerPeerId });
  return { success: true, viewerPeerId };
}

export function removePeer(peerId: string): Room | undefined {
  for (const [roomId, room] of roomMap) {
    if (room.host?.peerId === peerId) {
      logger.info("Host left, destroying room", { roomId, peerId });
      destroyRoom(roomId);
      return { roomId, host: null, viewers: new Map(), maxViewers: room.maxViewers };
    }
    if (room.viewers.has(peerId)) {
      room.viewers.delete(peerId);
      logger.info("Viewer left", { roomId, peerId });
      if (room.viewers.size === 0 && !room.host) {
        orphanTimestamps.set(roomId, Date.now());
      }
      return room;
    }
  }
  return undefined;
}

export function destroyRoom(roomId: string): void {
  const room = roomMap.get(roomId);
  if (!room) return;

  if (room.host && room.host.ws.readyState === 1) {
    room.host.ws.close(1001, "Room destroyed");
  }

  for (const viewer of room.viewers.values()) {
    if (viewer.ws.readyState === 1) {
      viewer.ws.close(1001, "Room destroyed");
    }
  }

  roomMap.delete(roomId);
  orphanTimestamps.delete(roomId);
  logger.info("Room destroyed", { roomId });
}

export function getHostPeerId(roomId: string): string | undefined {
  return roomMap.get(roomId)?.host?.peerId;
}

export function getViewerPeerIds(roomId: string): string[] {
  const room = roomMap.get(roomId);
  if (!room) return [];
  return Array.from(room.viewers.keys());
}

export function getWsForPeer(peerId: string): WebSocket | undefined {
  for (const room of roomMap.values()) {
    if (room.host?.peerId === peerId) return room.host.ws;
    const v = room.viewers.get(peerId);
    if (v) return v.ws;
  }
  return undefined;
}

export function sendToRoomExcept(
  roomId: string,
  excludePeerId: string,
  msg: Record<string, unknown>,
): void {
  const room = roomMap.get(roomId);
  if (!room) return;

  const data = JSON.stringify(msg);

  if (room.host && room.host.peerId !== excludePeerId && room.host.ws.readyState === 1) {
    room.host.ws.send(data);
  }

  for (const [vId, v] of room.viewers) {
    if (vId !== excludePeerId && v.ws.readyState === 1) {
      v.ws.send(data);
    }
  }
}

export function sendToPeer(peerId: string, msg: Record<string, unknown>): boolean {
  const ws = getWsForPeer(peerId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
    return true;
  }
  return false;
}

export function getRoomCount(): number {
  return roomMap.size;
}

export function cleanOrphanRooms(): void {
  const now = Date.now();
  const orphanTimeout = 60_000;
  for (const [roomId, timestamp] of orphanTimestamps) {
    if (now - timestamp > orphanTimeout) {
      orphanTimestamps.delete(roomId);
      const room = roomMap.get(roomId);
      if (room && !room.host && room.viewers.size === 0) {
        destroyRoom(roomId);
      }
    }
  }
}
