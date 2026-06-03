import { describe, it, expect } from "vitest";

describe("room-id", async () => {
  const { generateRoomId, isValidRoomId } = await import("../src/room-id");

  it("should generate a 6-digit room ID", () => {
    const id = generateRoomId();
    expect(id).toMatch(/^[0-9]{6}$/);
  });

  it("should generate unique room IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateRoomId());
    }
    expect(ids.size).toBe(100);
  });

  it("should validate valid room IDs", () => {
    expect(isValidRoomId("123456")).toBe(true);
    expect(isValidRoomId("000000")).toBe(true);
    expect(isValidRoomId("999999")).toBe(true);
  });

  it("should reject invalid room IDs", () => {
    expect(isValidRoomId("12345")).toBe(false);
    expect(isValidRoomId("1234567")).toBe(false);
    expect(isValidRoomId("abcdef")).toBe(false);
    expect(isValidRoomId("")).toBe(false);
    expect(isValidRoomId("12-456")).toBe(false);
  });
});
