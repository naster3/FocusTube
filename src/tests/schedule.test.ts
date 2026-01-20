import { describe, expect, it } from "vitest";
import type { IntervalWeek } from "../domain/settings/types";
import { isWithinBlockedSchedule, parseTimeToMinutes } from "../domain/schedule/schedule";

// Fixture de intervalos para pruebas.
const intervals = {
  1: [
    { id: "a1", start: "08:00", end: "10:00", mode: "blocked", enabled: true },
    { id: "a2", start: "14:00", end: "16:00", mode: "blocked", enabled: true }
  ],
  2: [{ id: "b1", start: "22:00", end: "02:00", mode: "blocked", enabled: true }]
} satisfies IntervalWeek;

// Suite de pruebas para utilidades de horarios.
describe("schedule", () => {
  it("parses time to minutes", () => {
    expect(parseTimeToMinutes("01:30")).toBe(90);
  });

  it("blocks during configured range", () => {
    const date = new Date("2024-01-01T08:30:00");
    expect(isWithinBlockedSchedule(date, intervals)).toBe(true);
  });

  it("allows outside configured range", () => {
    const date = new Date("2024-01-01T11:30:00");
    expect(isWithinBlockedSchedule(date, intervals)).toBe(false);
  });

  it("supports overnight range", () => {
    const date = new Date("2024-01-02T23:30:00");
    expect(isWithinBlockedSchedule(date, intervals)).toBe(true);
  });
});
