import { Interval, IntervalWeek, ProfileSettings, Settings, Metrics, WeekSchedule } from "./types";
import { getDayLabels } from "../../shared/i18n/dates";

export const SETTINGS_SCHEMA_VERSION = 3;
export const METRICS_SCHEMA_VERSION = 2;

// Schedules por defecto por dia.
export const DEFAULT_SCHEDULES: WeekSchedule = {
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
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
      enabled: true,
    }));
  }
  return intervals;
};

export const DEFAULT_INTERVALS: IntervalWeek = toIntervals(DEFAULT_SCHEDULES);

const cloneWeekSchedule = (input: WeekSchedule): WeekSchedule => {
  const next: WeekSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let day = 0; day <= 6; day += 1) {
    const ranges = input[day] || [];
    next[day] = ranges.map((range) => ({ start: range.start, end: range.end }));
  }
  return next;
};

const cloneIntervalWeek = (input: IntervalWeek): IntervalWeek => {
  const next: IntervalWeek = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let day = 0; day <= 6; day += 1) {
    const ranges = input[day] || [];
    next[day] = ranges.map((range) => ({ ...range }));
  }
  return next;
};

export const createDefaultProfile = (overrides: Partial<ProfileSettings> = {}): ProfileSettings => ({
  blockEnabled: false,
  blockShorts: true,
  blockKids: false,
  blockInstagramReels: false,
  blockedDomains: [],
  blockedDomainTags: {},
  whitelist: [],
  whitelistEnabled: true,
  schedules: cloneWeekSchedule(DEFAULT_SCHEDULES),
  intervalsByDay: cloneIntervalWeek(DEFAULT_INTERVALS),
  timeFormat12h: false,
  unblockUntil: null,
  weeklyUnblockEnabled: false,
  weeklyUnblockDays: [1],
  weeklyUnblockDurationMinutes: 60,
  weeklyUnblockUntil: null,
  weeklyUnblockLastWeek: null,
  ...overrides,
});

export const DEFAULT_PROFILE_ADULT = createDefaultProfile();
export const DEFAULT_PROFILE_KID = createDefaultProfile();

// Settings por defecto.
export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_SCHEMA_VERSION,
  blockEnabled: false,
  blockShorts: true,
  blockKids: false,
  blockInstagramReels: false,
  language: "en",
  theme: "light",
  familyModeEnabled: false,
  activeProfile: "adult",
  profiles: {
    adult: DEFAULT_PROFILE_ADULT,
    kid: DEFAULT_PROFILE_KID,
  },
  strictMode: false,
  pinHash: null,
  blockedDomains: [],
  blockedDomainTags: {},
  whitelist: [],
  whitelistEnabled: true,
  schedules: DEFAULT_SCHEDULES,
  intervalsByDay: DEFAULT_INTERVALS,
  timeFormat12h: false,
  unblockUntil: null,
  weeklyUnblockEnabled: false,
  weeklyUnblockDays: [1],
  weeklyUnblockDurationMinutes: 60,
  weeklyUnblockUntil: null,
  weeklyUnblockLastWeek: null,
};

// Metrics por defecto (v2).
export const DEFAULT_METRICS: Metrics = {
  version: METRICS_SCHEMA_VERSION,
  attemptsByDay: {},
  timeByDay: {},
  blockedTimeByDay: {},
  sessionsByDay: {},
  timeByDomainByDay: {},
  lastAttemptAt: null,
  lastAttemptUrl: null,
  lastUpdatedAt: null,
};

export const DAY_LABELS = getDayLabels("es");
