import { DEFAULT_INTERVALS, DEFAULT_METRICS, DEFAULT_SETTINGS } from "../domain/settings/defaults";
import { DomainTag, Interval, IntervalWeek, Metrics, Settings, WeekSchedule } from "../domain/settings/types";
import { isDomainTag } from "../domain/blocking/tags";

// Keys fijos en storage.local.
const SETTINGS_KEY = "settings";
const METRICS_KEY = "metrics";

// Inicializa defaults y migra estructuras antiguas.
export async function ensureDefaults() {
  const stored = await chrome.storage.local.get([SETTINGS_KEY, METRICS_KEY]);
  if (!stored[SETTINGS_KEY]) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  } else if (!Array.isArray(stored[SETTINGS_KEY].blockedDomains)) {
    const merged = mergeSettings(stored[SETTINGS_KEY]);
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  }
  if (!stored[METRICS_KEY]) {
    await chrome.storage.local.set({ [METRICS_KEY]: DEFAULT_METRICS });
  } else if (stored[METRICS_KEY].version !== 2) {
    const mergedMetrics = mergeMetrics(stored[METRICS_KEY]);
    await chrome.storage.local.set({ [METRICS_KEY]: mergedMetrics });
  }
}

// Settings completos con merge de defaults.
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return stored[SETTINGS_KEY] ? mergeSettings(stored[SETTINGS_KEY]) : DEFAULT_SETTINGS;
}

// Guarda settings completos.
export async function setSettings(settings: Settings) {
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
}

// Aplica patch y guarda settings completos.
export async function updateSettings(patch: Partial<Settings>) {
  const settings = await getSettings();
  const next = mergeSettings({ ...settings, ...patch });
  await setSettings(next);
  return next;
}

// Metrics completos con merge/migracion.
export async function getMetrics(): Promise<Metrics> {
  const stored = await chrome.storage.local.get(METRICS_KEY);
  return stored[METRICS_KEY] ? mergeMetrics(stored[METRICS_KEY]) : DEFAULT_METRICS;
}

// Guarda metrics completos.
export async function setMetrics(metrics: Metrics) {
  await chrome.storage.local.set({ [METRICS_KEY]: metrics });
}

// Aplica patch y guarda metrics completos.
export async function updateMetrics(patch: Partial<Metrics>) {
  const metrics = await getMetrics();
  const next = mergeMetrics({ ...metrics, ...patch });
  await setMetrics(next);
  return next;
}

// Reinicia metrics a defaults.
export async function resetMetrics() {
  await setMetrics(DEFAULT_METRICS);
}

// Incrementa intentos bloqueados.
export async function incrementAttempt(timestamp: number) {
  const metrics = await getMetrics();
  const dateKey = new Date(timestamp).toISOString().slice(0, 10);
  const nextCount = (metrics.attemptsByDay[dateKey] || 0) + 1;
  const next = mergeMetrics({
    ...metrics,
    attemptsByDay: { ...metrics.attemptsByDay, [dateKey]: nextCount },
    lastAttemptAt: timestamp,
    lastUpdatedAt: timestamp
  });
  await setMetrics(next);
}

// Merge profundo de schedules por dia.
function mergeSchedules(input?: WeekSchedule): WeekSchedule {
  const next: WeekSchedule = { ...DEFAULT_SETTINGS.schedules };
  if (!input) {
    return next;
  }
  for (const [dayKey, ranges] of Object.entries(input)) {
    const day = Number(dayKey);
    if (Number.isNaN(day) || !Array.isArray(ranges)) {
      continue;
    }
    next[day] = ranges.map((range) => ({
      start: range.start || "00:00",
      end: range.end || "00:00"
    }));
  }
  return next;
}

function schedulesToIntervals(input: WeekSchedule): IntervalWeek {
  const intervals: IntervalWeek = { ...DEFAULT_INTERVALS };
  for (const [dayKey, ranges] of Object.entries(input)) {
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
}

function mergeIntervalsByDay(input?: IntervalWeek, fallbackSchedules?: WeekSchedule): IntervalWeek {
  if (!input) {
    return fallbackSchedules ? schedulesToIntervals(fallbackSchedules) : { ...DEFAULT_INTERVALS };
  }
  const next: IntervalWeek = { ...DEFAULT_INTERVALS };
  for (const [dayKey, ranges] of Object.entries(input)) {
    const day = Number(dayKey);
    if (Number.isNaN(day) || !Array.isArray(ranges)) {
      continue;
    }
    next[day] = ranges.map((range, idx) => ({
      id: range.id || `day-${day}-${idx}-${range.start}-${range.end}`,
      start: range.start,
      end: range.end,
      mode: range.mode === "free" ? "free" : "blocked",
      enabled: Boolean(range.enabled)
    }));
  }
  return next;
}

function normalizeBlockedDomainTags(input?: Record<string, unknown>): Record<string, DomainTag[]> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const next: Record<string, DomainTag[]> = {};
  for (const [domain, value] of Object.entries(input)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const tags = value
      .map((tag) => String(tag))
      .filter((tag): tag is DomainTag => isDomainTag(tag));
    const unique = Array.from(new Set(tags));
    if (unique.length > 0) {
      next[domain] = unique;
    }
  }
  return next;
}

// Merge de settings, con defaults y validacion basica.
export function mergeSettings(input: Partial<Settings>): Settings {
  const weeklyDays = Array.isArray(input.weeklyUnblockDays)
    ? Array.from(
        new Set(
          input.weeklyUnblockDays
            .map((day) => Number(day))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )
      ).sort((a, b) => a - b)
    : DEFAULT_SETTINGS.weeklyUnblockDays;
  const weeklyDuration =
    typeof input.weeklyUnblockDurationMinutes === "number" && Number.isFinite(input.weeklyUnblockDurationMinutes)
      ? Math.max(1, Math.floor(input.weeklyUnblockDurationMinutes))
      : DEFAULT_SETTINGS.weeklyUnblockDurationMinutes;
  const weeklyUntil =
    typeof input.weeklyUnblockUntil === "number" && Number.isFinite(input.weeklyUnblockUntil)
      ? input.weeklyUnblockUntil
      : null;
  const weeklyLastWeek = typeof input.weeklyUnblockLastWeek === "string" ? input.weeklyUnblockLastWeek : null;
  const blockedDomainTags = normalizeBlockedDomainTags(input.blockedDomainTags as Record<string, unknown>);
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    weeklyUnblockEnabled: Boolean(input.weeklyUnblockEnabled),
    weeklyUnblockDays: weeklyDays,
    weeklyUnblockDurationMinutes: weeklyDuration,
    weeklyUnblockUntil: weeklyUntil,
    weeklyUnblockLastWeek: weeklyLastWeek,
    schedules: mergeSchedules(input.schedules),
    intervalsByDay: mergeIntervalsByDay(input.intervalsByDay, input.schedules),
    whitelist: Array.isArray(input.whitelist) ? input.whitelist : DEFAULT_SETTINGS.whitelist,
    blockedDomains: Array.isArray(input.blockedDomains)
      ? input.blockedDomains
      : DEFAULT_SETTINGS.blockedDomains,
    blockedDomainTags
  };
}

// Merge de metrics v2 con defaults.
export function mergeMetrics(input: Partial<Metrics>): Metrics {
  return {
    ...DEFAULT_METRICS,
    ...input,
    version: 2,
    attemptsByDay: input.attemptsByDay || DEFAULT_METRICS.attemptsByDay,
    timeByDay: input.timeByDay || DEFAULT_METRICS.timeByDay,
    blockedTimeByDay: input.blockedTimeByDay || DEFAULT_METRICS.blockedTimeByDay,
    sessionsByDay: input.sessionsByDay || DEFAULT_METRICS.sessionsByDay,
    timeByDomainByDay: input.timeByDomainByDay || DEFAULT_METRICS.timeByDomainByDay
  };
}
