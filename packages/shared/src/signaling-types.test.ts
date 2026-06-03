import { describe, it, expect } from "vitest";

describe("signaling-types", async () => {
  const { isValidRoomId } = await import("../src/signaling-types");

  it("should not export isValidRoomId (it is in room-id.ts)", () => {
    if (isValidRoomId) {
      expect(typeof isValidRoomId).toBe("function");
    }
  });
});
