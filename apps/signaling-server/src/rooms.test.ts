import { describe, it, expect, beforeEach } from "vitest";
import { createRoom, addViewerToRoom, removePeer, getRoom, getHostPeerId, getViewerPeerIds, clearAllRooms } from "../src/rooms";
import type { WebSocket } from "ws";

function createMockWs(): WebSocket {
  return {
    readyState: 1,
    send: () => {},
    close: () => {},
  } as unknown as WebSocket;
}

describe("room management", () => {
  beforeEach(() => {
    clearAllRooms();
  });

  it("should create a room", () => {
    const ws = createMockWs();
    const room = createRoom(ws, "host-1");
    expect(room.roomId).toMatch(/^[0-9]{6}$/);
    expect(room.host?.peerId).toBe("host-1");
    expect(room.viewers.size).toBe(0);
  });

  it("should add a viewer to a room", () => {
    const hostWs = createMockWs();
    const room = createRoom(hostWs, "host-1");
    const viewerWs = createMockWs();

    const result = addViewerToRoom(room.roomId, viewerWs, "viewer-1");
    expect(result.success).toBe(true);

    const updated = getRoom(room.roomId);
    expect(updated?.viewers.size).toBe(1);
    expect(updated?.viewers.get("viewer-1")?.peerId).toBe("viewer-1");
  });

  it("should reject adding viewer to non-existent room", () => {
    const result = addViewerToRoom("999999", createMockWs(), "viewer-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("ROOM_NOT_FOUND");
    }
  });

  it("should reject adding viewer when room is full", () => {
    process.env.MAX_VIEWERS_PER_ROOM = "1";
    const hostWs = createMockWs();
    const room = createRoom(hostWs, "host-1");

    const result1 = addViewerToRoom(room.roomId, createMockWs(), "viewer-1");
    expect(result1.success).toBe(true);

    const result2 = addViewerToRoom(room.roomId, createMockWs(), "viewer-2");
    expect(result2.success).toBe(false);
    if (!result2.success) {
      expect(result2.error).toBe("ROOM_FULL");
    }

    delete process.env.MAX_VIEWERS_PER_ROOM;
  });

  it("should remove a viewer from room", () => {
    const hostWs = createMockWs();
    const room = createRoom(hostWs, "host-1");
    addViewerToRoom(room.roomId, createMockWs(), "viewer-1");

    const result = removePeer("viewer-1");
    expect(result?.wasHost).toBe(false);

    const updated = getRoom(room.roomId);
    expect(updated?.viewers.has("viewer-1")).toBe(false);
  });

  it("should destroy room when host leaves", () => {
    const hostWs = createMockWs();
    const room = createRoom(hostWs, "host-1");
    addViewerToRoom(room.roomId, createMockWs(), "viewer-1");

    const result = removePeer("host-1");
    expect(result?.wasHost).toBe(true);
    expect(result?.viewerPeerIds).toContain("viewer-1");

    expect(getRoom(room.roomId)).toBeUndefined();
  });

  it("should return host peer ID", () => {
    const room = createRoom(createMockWs(), "host-abc");
    expect(getHostPeerId(room.roomId)).toBe("host-abc");
  });

  it("should return viewer peer IDs", () => {
    const room = createRoom(createMockWs(), "host-1");
    addViewerToRoom(room.roomId, createMockWs(), "viewer-1");
    addViewerToRoom(room.roomId, createMockWs(), "viewer-2");

    const ids = getViewerPeerIds(room.roomId);
    expect(ids).toHaveLength(2);
    expect(ids).toContain("viewer-1");
    expect(ids).toContain("viewer-2");
  });
});
