import { describe, it, expect } from "vitest";

describe("uuid", async () => {
  const { randomUUID } = await import("../src/uuid");

  it("should generate a valid UUID string", () => {
    const id = randomUUID();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThanOrEqual(32);
  });

  it("should generate unique UUIDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(randomUUID());
    }
    expect(ids.size).toBe(100);
  });
});
