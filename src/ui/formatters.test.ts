import { describe, it, expect } from "vitest";
import {
  formatDistance,
  formatDuration,
  formatSpeed,
  formatSport,
} from "./formatters";

describe("formatDistance", () => {
  it("formats meters below 1000 as metres", () => {
    expect(formatDistance(500)).toBe("500 m");
  });

  it("rounds sub-kilometre values", () => {
    expect(formatDistance(750.6)).toBe("751 m");
  });

  it("formats 1000 m as 1.0 km", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
  });

  it("formats large distances in km to 1 decimal", () => {
    expect(formatDistance(9094)).toBe("9.1 km");
    expect(formatDistance(42195)).toBe("42.2 km");
  });
});

describe("formatDuration", () => {
  it("formats seconds-only as 0m", () => {
    expect(formatDuration(45)).toBe("0m");
  });

  it("formats minutes only", () => {
    expect(formatDuration(3 * 60)).toBe("3m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600 + 30 * 60)).toBe("1h 30m");
  });

  it("formats exactly 1 hour", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("formats multiple hours", () => {
    expect(formatDuration(7 * 3600 + 15 * 60)).toBe("7h 15m");
  });
});

describe("formatSpeed", () => {
  it("returns empty string when seconds is 0", () => {
    expect(formatSpeed(1000, 0)).toBe("");
  });

  it("calculates km/h correctly", () => {
    // 10 km in 3600 s = 10 km/h
    expect(formatSpeed(10000, 3600)).toBe("10.0 km/h");
  });

  it("rounds to 1 decimal", () => {
    // 9094 m in 3419 s ≈ 9.6 km/h
    expect(formatSpeed(9094, 3419)).toBe("9.6 km/h");
  });
});

describe("formatSport", () => {
  it("maps known sport types to human labels", () => {
    expect(formatSport("jogging")).toBe("Running");
    expect(formatSport("mtb")).toBe("MTB");
    expect(formatSport("hiking")).toBe("Hiking");
    expect(formatSport("road_cycling")).toBe("Road Cycling");
  });

  it("falls back to the raw value for unknown sports", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatSport("unknown_sport" as any)).toBe("unknown_sport");
  });
});
