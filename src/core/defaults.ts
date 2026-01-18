import { Interval, IntervalWeek, Settings, Metrics, WeekSchedule } from "./types";

// Schedules por defecto por dia.
export const DEFAULT_SCHEDULES: WeekSchedule = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: []
};

// Intervalos por defecto derivados de schedules.
const toIntervals = (schedules: WeekSchedule): IntervalWeek => {
  const intervals: IntervalWeek = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const [dayKey, ranges] of Object.entries(schedules)) {
    const day = Number(dayKey);
    if (Number.isNaN(day) || !Array.isArray(ranges)) {
      continue;
    }
    intervals[day] = ranges.map((range, idx) => ({
      id: `day-${day}-${idx}-${range.start}-${range.end}`,
      start: range.start as Interval["start"],
      end: range.end as Interval["end"],
      mode: "blocked",
      enabled: true
    }));
  }
  return intervals;
};

export const DEFAULT_INTERVALS: IntervalWeek = toIntervals(DEFAULT_SCHEDULES);

// Settings por defecto.
export const DEFAULT_SETTINGS: Settings = {
  blockEnabled: false,
  blockShorts: true,
  blockKids: false,
  language: "en",
  strictMode: false,
  pinHash: null,
  blockedDomains: [],
  whitelist: [],
  schedules: DEFAULT_SCHEDULES,
  intervalsByDay: DEFAULT_INTERVALS,
  timeFormat12h: false,
  unblockUntil: null
};

// Metrics por defecto (v2).
export const DEFAULT_METRICS: Metrics = {
  version: 2,
  attemptsByDay: {},
  timeByDay: {},
  blockedTimeByDay: {},
  sessionsByDay: {},
  timeByDomainByDay: {},
  lastAttemptAt: null,
  lastUpdatedAt: null
};

export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
