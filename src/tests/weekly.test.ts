import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings/defaults";
import type { DomainTag, Interval } from "../domain/settings/types";
import { evaluateBlock } from "../domain/blocking/url";
import { canStartWeeklySession, getWeeklySessionWeekKey, isWeeklySessionActive } from "../domain/weekly/weekly";

describe("weekly session rules", () => {
  it("allows weekly session only on configured days", () => {
    const monday = new Date(2024, 0, 1, 12, 0, 0);
    const tuesday = new Date(2024, 0, 2, 12, 0, 0);
    const settings = {
      ...DEFAULT_SETTINGS,
      weeklyUnblockEnabled: true,
      weeklyUnblockDays: [1]
    };

    expect(canStartWeeklySession(settings, monday.getTime())).toBe(true);
    expect(canStartWeeklySession(settings, tuesday.getTime())).toBe(false);
  });

  it("blocks weekly session if already used in the same week", () => {
    const monday = new Date(2024, 0, 1, 12, 0, 0);
    const usedWeek = getWeeklySessionWeekKey(monday.getTime());
    const settings = {
      ...DEFAULT_SETTINGS,
      weeklyUnblockEnabled: true,
      weeklyUnblockDays: [1],
      weeklyUnblockLastWeek: usedWeek
    };

    expect(canStartWeeklySession(settings, monday.getTime())).toBe(false);
  });

  it("unblocks por_semana when weekly session is active", () => {
    const now = Date.now();
    const tags: DomainTag[] = ["por_semana"];
    const settings = {
      ...DEFAULT_SETTINGS,
      blockedDomains: ["youtube.com"],
      blockedDomainTags: { "youtube.com": tags },
      weeklyUnblockEnabled: true,
      weeklyUnblockUntil: now + 10 * 60 * 1000
    };

    expect(isWeeklySessionActive(settings, now)).toBe(true);
    expect(evaluateBlock("https://youtube.com/watch?v=1", settings, now).blocked).toBe(false);
  });

  it("blocks por_semana when weekly session is not active", () => {
    const now = Date.now();
    const tags: DomainTag[] = ["por_semana"];
    const settings = {
      ...DEFAULT_SETTINGS,
      blockedDomains: ["youtube.com"],
      blockedDomainTags: { "youtube.com": tags },
      weeklyUnblockEnabled: true,
      weeklyUnblockUntil: null
    };

    const decision = evaluateBlock("https://youtube.com/watch?v=1", settings, now);
    expect(decision.blocked).toBe(true);
    expect(decision.reason).toBe("manual");
  });

  it("blocks when a blocked domain has no tags", () => {
    const now = Date.now();
    const settings = {
      ...DEFAULT_SETTINGS,
      blockedDomains: ["youtube.com"],
      blockedDomainTags: {}
    };

    const decision = evaluateBlock("https://youtube.com/watch?v=1", settings, now);
    expect(decision.blocked).toBe(true);
    expect(decision.reason).toBe("missing_tag");
  });

  it("prioritizes intervalos over por_semana when both tags exist", () => {
    const mondayBlocked = new Date(2024, 0, 1, 10, 30, 0);
    const mondayFree = new Date(2024, 0, 1, 12, 0, 0);
    const interval: Interval = {
      id: "x",
      start: "10:00" as Interval["start"],
      end: "11:00" as Interval["end"],
      mode: "blocked",
      enabled: true
    };
    const tags: DomainTag[] = ["intervalos", "por_semana"];
    const settings = {
      ...DEFAULT_SETTINGS,
      blockedDomains: ["youtube.com"],
      blockedDomainTags: { "youtube.com": tags },
      intervalsByDay: { ...DEFAULT_SETTINGS.intervalsByDay, 1: [interval] }
    };

    const blockedDecision = evaluateBlock("https://youtube.com/watch?v=1", settings, mondayBlocked.getTime());
    expect(blockedDecision.blocked).toBe(true);
    expect(blockedDecision.reason).toBe("schedule");

    const freeDecision = evaluateBlock("https://youtube.com/watch?v=1", settings, mondayFree.getTime());
    expect(freeDecision.blocked).toBe(false);
  });
});
