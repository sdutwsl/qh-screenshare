import { describe, it, expect } from "vitest";
import { validateMessage, isValidWebSocketMessage } from "../src/protocol";

describe("validateMessage", () => {
  it("should reject non-objects", () => {
    expect(validateMessage(null)).toBeNull();
    expect(validateMessage("string")).toBeNull();
    expect(validateMessage(123)).toBeNull();
    expect(validateMessage(undefined)).toBeNull();
  });

  it("should reject messages without type", () => {
    expect(validateMessage({})).toBeNull();
    expect(validateMessage({ roomId: "123456" })).toBeNull();
  });

  it("should reject unknown message types", () => {
    expect(validateMessage({ type: "unknown" })).toBeNull();
    expect(validateMessage({ type: "hack" })).toBeNull();
  });

  it("should validate create-room message", () => {
    expect(
      validateMessage({ type: "create-room", role: "host", peerId: "peer-1" }),
    ).toBeTruthy();
    expect(
      validateMessage({ type: "create-room", role: "viewer", peerId: "peer-1" }),
    ).toBeNull();
    expect(
      validateMessage({ type: "create-room", role: "host" }),
    ).toBeNull();
  });

  it("should validate join-room message", () => {
    expect(
      validateMessage({
        type: "join-room",
        role: "viewer",
        roomId: "123456",
        peerId: "peer-1",
      }),
    ).toBeTruthy();
    expect(
      validateMessage({
        type: "join-room",
        role: "viewer",
        roomId: "12345",
        peerId: "peer-1",
      }),
    ).toBeNull();
    expect(
      validateMessage({
        type: "join-room",
        role: "viewer",
        roomId: "123456",
      }),
    ).toBeNull();
  });

  it("should validate leave message", () => {
    expect(
      validateMessage({
        type: "leave",
        roomId: "123456",
        peerId: "peer-1",
      }),
    ).toBeTruthy();
    expect(
      validateMessage({
        type: "leave",
        roomId: "123456",
      }),
    ).toBeNull();
  });

  it("should validate offer message", () => {
    expect(
      validateMessage({
        type: "offer",
        roomId: "123456",
        fromPeerId: "host-1",
        toPeerId: "viewer-1",
        sdp: { type: "offer", sdp: "v=0" },
      }),
    ).toBeTruthy();
    expect(
      validateMessage({
        type: "offer",
        roomId: "123456",
        fromPeerId: "host-1",
        toPeerId: "viewer-1",
      }),
    ).toBeNull();
  });

  it("should validate ice-candidate message", () => {
    expect(
      validateMessage({
        type: "ice-candidate",
        roomId: "123456",
        fromPeerId: "viewer-1",
        toPeerId: "host-1",
        candidate: { candidate: "candidate:1", sdpMLineIndex: 0 },
      }),
    ).toBeTruthy();
    expect(
      validateMessage({
        type: "ice-candidate",
        roomId: "123456",
        fromPeerId: "viewer-1",
        toPeerId: "host-1",
      }),
    ).toBeNull();
  });
});

describe("isValidWebSocketMessage", () => {
  it("should accept Buffer within size limit", () => {
    const buf = Buffer.from(JSON.stringify({ type: "create-room" }));
    expect(isValidWebSocketMessage(buf)).toBe(true);
  });

  it("should accept string within size limit", () => {
    expect(isValidWebSocketMessage("hello")).toBe(true);
  });

  it("should reject oversized messages", () => {
    const large = "x".repeat(65 * 1024);
    expect(isValidWebSocketMessage(Buffer.from(large))).toBe(false);
    expect(isValidWebSocketMessage(large)).toBe(false);
  });

  it("should accept messages at the size limit", () => {
    const atLimit = "x".repeat(64 * 1024);
    expect(isValidWebSocketMessage(Buffer.from(atLimit))).toBe(true);
  });
});
