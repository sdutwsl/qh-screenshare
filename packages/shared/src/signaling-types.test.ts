import { describe, it, expect } from "vitest";
import {
  DEFAULT_RTC_CONFIG,
  SIGNALING_PATH,
  HEALTHZ_PATH,
  MAX_VIEWERS_PER_ROOM,
} from "../src/signaling-types";

describe("signaling-types constants", () => {
  it("should define DEFAULT_RTC_CONFIG with STUN server", () => {
    expect(DEFAULT_RTC_CONFIG.iceServers).toHaveLength(1);
    expect(DEFAULT_RTC_CONFIG.iceServers[0].urls).toContain("stun.l.google.com");
  });

  it("should define SIGNALING_PATH as /ws", () => {
    expect(SIGNALING_PATH).toBe("/ws");
  });

  it("should define HEALTHZ_PATH as /healthz", () => {
    expect(HEALTHZ_PATH).toBe("/healthz");
  });

  it("should define MAX_VIEWERS_PER_ROOM as 4", () => {
    expect(MAX_VIEWERS_PER_ROOM).toBe(4);
  });
});
