import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings/defaults";
import { computeScheduleTimeline } from "../domain/schedule/timeline";
import type { IntervalWeek } from "../domain/settings/types";

describe("schedule timeline", () => {
  it("marks overnight saturday blocks as carryover on sunday", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      intervalsByDay: {
        ...DEFAULT_SETTINGS.intervalsByDay,
        6: [{ id: "sat-night", start: "23:00", end: "02:00", mode: "blocked", enabled: true }],
      } satisfies IntervalWeek,
    };

    const timeline = computeScheduleTimeline(settings, new Date(2024, 0, 7, 0, 30, 0).getTime());

    expect(timeline.state).toBe("blocked");
    expect(timeline.reason).toBe("schedule");
    expect(timeline.isCarryover).toBe(true);
    expect(timeline.currentSourceDay).toBe(6);
    expect(timeline.currentBlockEnd).toBe(new Date(2024, 0, 7, 2, 0, 0).getTime());
  });

  it("keeps carryover metadata while temporary unblock is active", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      unblockUntil: new Date(2024, 0, 7, 0, 40, 0).getTime(),
      intervalsByDay: {
        ...DEFAULT_SETTINGS.intervalsByDay,
        6: [{ id: "sat-night", start: "23:00", end: "02:00", mode: "blocked", enabled: true }],
      } satisfies IntervalWeek,
    };

    const timeline = computeScheduleTimeline(settings, new Date(2024, 0, 7, 0, 30, 0).getTime());

    expect(timeline.state).toBe("free");
    expect(timeline.reason).toBe("temporary_unblock");
    expect(timeline.isCarryover).toBe(true);
    expect(timeline.currentSourceDay).toBe(6);
    expect(timeline.currentBlockEnd).toBe(new Date(2024, 0, 7, 2, 0, 0).getTime());
    expect(timeline.currentUntil).toBe(new Date(2024, 0, 7, 0, 40, 0).getTime());
  });
});
