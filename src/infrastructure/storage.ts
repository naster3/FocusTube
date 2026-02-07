import { DEFAULT_INTERVALS, DEFAULT_METRICS, DEFAULT_SETTINGS } from "../domain/settings/defaults";
import { DomainTag, Interval, IntervalWeek, Metrics, Settings, WeekSchedule } from "../domain/settings/types";
import { isDomainTag } from "../domain/blocking/tags";
import { normalizeDomain, normalizeWhitelistEntry } from "../domain/blocking/url";
import { devLog } from "../shared/devLogger";

// Keys fijos en storage.local.
const SETTINGS_KEY = "settings";
const METRICS_KEY = "metrics";
const LOCAL_PREFIX = "focustube:";
const DEV_FALLBACK = import.meta.env.DEV;
let loggedFallback = false;
let loggedNoChromeListener = false;

type StorageAreaLike = {
  get: (keys?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>) => Promise<void>;
  remove: (keys: string | string[]) => Promise<void>;
  clear: () => Promise<void>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function asSettingsCandidate(value: unknown): Partial<Settings> | null {
  const obj = asObject(value);
  return obj ? (obj as Partial<Settings>) : null;
}

function asMetricsCandidate(value: unknown): Partial<Metrics> | null {
  const obj = asObject(value);
  return obj ? (obj as Partial<Metrics>) : null;
}

function hasChromeStorage() {
  return typeof chrome !== "undefined" && Boolean(chrome?.storage?.local);
}

function normalizeKeys(keys?: string | string[] | Record<string, unknown>) {
  if (!keys) {
    return [SETTINGS_KEY, METRICS_KEY];
  }
  if (Array.isArray(keys)) {
    return keys.map(String);
  }
  if (typeof keys === "string") {
    return [keys];
  }
  return Object.keys(keys);
}

function localKey(key: string) {
  return `${LOCAL_PREFIX}${key}`;
}

function createLocalStorageArea(): StorageAreaLike {
  const localStorageRef = typeof window === "undefined" ? null : window.localStorage;
  return {
    async get(keys) {
      const result: Record<string, unknown> = {};
      if (!localStorageRef) {
        return result;
      }
      for (const key of normalizeKeys(keys)) {
        const raw = localStorageRef.getItem(localKey(key));
        if (raw !== null) {
          try {
            result[key] = JSON.parse(raw);
          } catch {
            // Ignore invalid JSON; treat as missing.
          }
        }
      }
      return result;
    },
    async set(items) {
      if (!localStorageRef) {
        return;
      }
      for (const [key, value] of Object.entries(items)) {
        localStorageRef.setItem(localKey(key), JSON.stringify(value));
      }
    },
    async remove(keys) {
      if (!localStorageRef) {
        return;
      }
      for (const key of normalizeKeys(keys)) {
        localStorageRef.removeItem(localKey(key));
      }
    },
    async clear() {
      if (!localStorageRef) {
        return;
      }
      for (const key of [SETTINGS_KEY, METRICS_KEY]) {
        localStorageRef.removeItem(localKey(key));
      }
    }
  };
}

function getStorageArea(): StorageAreaLike {
  if (hasChromeStorage()) {
    return chrome.storage.local;
  }
  if (!DEV_FALLBACK) {
    throw new Error("chrome.storage.local is not available outside the extension context.");
  }
  if (!loggedFallback) {
    devLog("Using localStorage fallback for settings/metrics.");
    loggedFallback = true;
  }
  return createLocalStorageArea();
}

export function onStorageChanged(listener: (changes: Record<string, chrome.storage.StorageChange>, area: string) => void) {
  if (!hasChromeStorage()) {
    if (!DEV_FALLBACK) {
      throw new Error("chrome.storage.onChanged is not available outside the extension context.");
    }
    if (!loggedNoChromeListener) {
      devLog("chrome.storage.onChanged not available; using no-op listener in dev.");
      loggedNoChromeListener = true;
    }
    return () => undefined;
  }
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// Inicializa defaults y migra estructuras antiguas.
export async function ensureDefaults() {
  const storage = getStorageArea();
  const stored = await storage.get([SETTINGS_KEY, METRICS_KEY]);
  const storedSettings = asSettingsCandidate(stored[SETTINGS_KEY]);
  if (!storedSettings) {
    await storage.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
    devLog("storage.ensureDefaults: settings initialized");
  } else if (!Array.isArray(storedSettings.blockedDomains)) {
    const merged = mergeSettings(storedSettings);
    await storage.set({ [SETTINGS_KEY]: merged });
    devLog("storage.ensureDefaults: settings migrated");
  }
  const storedMetrics = asMetricsCandidate(stored[METRICS_KEY]);
  if (!storedMetrics) {
    await storage.set({ [METRICS_KEY]: DEFAULT_METRICS });
    devLog("storage.ensureDefaults: metrics initialized");
  } else if (storedMetrics.version !== 2) {
    const mergedMetrics = mergeMetrics(storedMetrics);
    await storage.set({ [METRICS_KEY]: mergedMetrics });
    devLog("storage.ensureDefaults: metrics migrated");
  }
}

// Settings completos con merge de defaults.
export async function getSettings(): Promise<Settings> {
  const storage = getStorageArea();
  const stored = await storage.get(SETTINGS_KEY);
  const storedSettings = asSettingsCandidate(stored[SETTINGS_KEY]);
  const settings = storedSettings ? mergeSettings(storedSettings) : DEFAULT_SETTINGS;
  devLog("storage.getSettings");
  return settings;
}

// Guarda settings completos.
export async function setSettings(settings: Settings) {
  const storage = getStorageArea();
  await storage.set({ [SETTINGS_KEY]: settings });
  devLog("storage.setSettings", {
    blockEnabled: settings.blockEnabled,
    blockedDomains: settings.blockedDomains.length,
    whitelist: settings.whitelist.length
  });
}

// Aplica patch y guarda settings completos.
export async function updateSettings(patch: Partial<Settings>) {
  const settings = await getSettings();
  const next = mergeSettings({ ...settings, ...patch });
  await setSettings(next);
  devLog("storage.updateSettings", Object.keys(patch));
  return next;
}

// Metrics completos con merge/migracion.
export async function getMetrics(): Promise<Metrics> {
  const storage = getStorageArea();
  const stored = await storage.get(METRICS_KEY);
  const storedMetrics = asMetricsCandidate(stored[METRICS_KEY]);
  const metrics = storedMetrics ? mergeMetrics(storedMetrics) : DEFAULT_METRICS;
  devLog("storage.getMetrics");
  return metrics;
}

// Guarda metrics completos.
export async function setMetrics(metrics: Metrics) {
  const storage = getStorageArea();
  await storage.set({ [METRICS_KEY]: metrics });
  devLog("storage.setMetrics", {
    attemptsByDay: Object.keys(metrics.attemptsByDay).length,
    timeByDay: Object.keys(metrics.timeByDay).length
  });
}

// Aplica patch y guarda metrics completos.
export async function updateMetrics(patch: Partial<Metrics>) {
  const metrics = await getMetrics();
  const next = mergeMetrics({ ...metrics, ...patch });
  await setMetrics(next);
  devLog("storage.updateMetrics", Object.keys(patch));
  return next;
}

// Reinicia metrics a defaults.
export async function resetMetrics() {
  await setMetrics(DEFAULT_METRICS);
  devLog("storage.resetMetrics");
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
  devLog("metrics.incrementAttempt", { dateKey, count: nextCount });
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

function normalizeBlockedDomainTags(
  input?: Record<string, unknown>,
  allowedDomains?: Set<string>
): Record<string, DomainTag[]> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const next: Record<string, DomainTag[]> = {};
  for (const [domain, value] of Object.entries(input)) {
    const normalizedDomain = normalizeDomain(domain);
    if (!normalizedDomain) {
      continue;
    }
    if (allowedDomains && !allowedDomains.has(normalizedDomain)) {
      continue;
    }
    if (!Array.isArray(value)) {
      continue;
    }
    const tags = value
      .map((tag) => String(tag))
      .filter((tag): tag is DomainTag => isDomainTag(tag));
    const unique = Array.from(new Set(tags));
    if (unique.length > 0) {
      next[normalizedDomain] = unique;
    }
  }
  return next;
}

// Merge de settings, con defaults y validacion basica.
export function mergeSettings(input: Partial<Settings>): Settings {
  const pinHash = typeof input.pinHash === "string" ? input.pinHash : null;
  const blockedDomains = Array.isArray(input.blockedDomains)
    ? Array.from(
        new Set(
          input.blockedDomains
            .map((domain) => normalizeDomain(domain))
            .filter((domain): domain is string => Boolean(domain))
        )
      )
    : DEFAULT_SETTINGS.blockedDomains;
  const whitelist = Array.isArray(input.whitelist)
    ? Array.from(
        new Set(
          input.whitelist
            .map((entry) => normalizeWhitelistEntry(entry))
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    : DEFAULT_SETTINGS.whitelist;
  const blockedDomainsSet = new Set(blockedDomains);
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
  const blockedDomainTags = normalizeBlockedDomainTags(
    input.blockedDomainTags as Record<string, unknown>,
    blockedDomainsSet
  );
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    pinHash,
    weeklyUnblockEnabled: Boolean(input.weeklyUnblockEnabled),
    blockInstagramReels: Boolean(input.blockInstagramReels),
    weeklyUnblockDays: weeklyDays,
    weeklyUnblockDurationMinutes: weeklyDuration,
    weeklyUnblockUntil: weeklyUntil,
    weeklyUnblockLastWeek: weeklyLastWeek,
    schedules: mergeSchedules(input.schedules),
    intervalsByDay: mergeIntervalsByDay(input.intervalsByDay, input.schedules),
    whitelist,
    blockedDomains,
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
