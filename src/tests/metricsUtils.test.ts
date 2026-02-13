import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Metrics } from "../domain/settings/types";
import {
  deltaClass,
  formatSeconds,
  getDayKey,
  getRecentDays,
  percentDelta,
  sumMetricRange
} from "../domain/metrics/utils";

describe("metrics utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats seconds into time strings", () => {
    expect(formatSeconds(0)).toBe("0:00");
    expect(formatSeconds(59)).toBe("0:59");
    expect(formatSeconds(61)).toBe("1:01");
    expect(formatSeconds(3661)).toBe("1:01:01");
  });

  it("gets a day key in ISO format", () => {
    expect(getDayKey(new Date("2024-02-05T10:00:00Z"))).toBe("2024-02-05");
  });

  it("builds a list of recent days", () => {
    expect(getRecentDays(3)).toEqual(["2024-01-10", "2024-01-09", "2024-01-08"]);
  });

  it("calculates percentage deltas", () => {
    expect(percentDelta(0, 0)).toBe("0%");
    expect(percentDelta(5, 0)).toBe("+100%");
    expect(percentDelta(5, 10)).toBe("-50%");
  });

  it("returns delta classes", () => {
    expect(deltaClass(0, 0)).toBe("neutral");
    expect(deltaClass(5, 0)).toBe("positive");
    expect(deltaClass(5, 5)).toBe("neutral");
    expect(deltaClass(10, 5)).toBe("positive");
    expect(deltaClass(3, 5)).toBe("negative");
  });

  it("sums metric ranges safely", () => {
    const metrics: Metrics = {
      version: 1,
      attemptsByDay: { "2024-01-10": 2, "2024-01-09": 3 },
      timeByDay: {},
      blockedTimeByDay: {},
      sessionsByDay: {},
      timeByDomainByDay: {},
      lastAttemptAt: null,
      lastUpdatedAt: null
    };
    expect(sumMetricRange(metrics, ["2024-01-10", "2024-01-08"], "attemptsByDay")).toBe(2);
    expect(sumMetricRange(metrics, ["2024-01-10", "2024-01-09"], "attemptsByDay")).toBe(5);
  });
});
