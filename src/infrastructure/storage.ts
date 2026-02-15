import {
  DEFAULT_INTERVALS,
  DEFAULT_METRICS,
  DEFAULT_SETTINGS,
  METRICS_SCHEMA_VERSION,
  SETTINGS_SCHEMA_VERSION
} from "../domain/settings/defaults";
import {
  DomainTag,
  Interval,
  IntervalWeek,
  Metrics,
  ProfileId,
  ProfileSettings,
  Settings,
  WeekSchedule
} from "../domain/settings/types";
import { syncProfiles } from "../domain/settings/profiles";
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
const devStorageListeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();

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

function notifyDevStorageListeners(changes: Record<string, chrome.storage.StorageChange>) {
  if (devStorageListeners.size === 0) {
    return;
  }
  devStorageListeners.forEach((listener) => {
    try {
      listener(changes, "local");
    } catch {
      // ignore listener errors in dev fallback
    }
  });
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
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [key, value] of Object.entries(items)) {
        let oldValue: unknown = undefined;
        const rawOld = localStorageRef.getItem(localKey(key));
        if (rawOld !== null) {
          try {
            oldValue = JSON.parse(rawOld);
          } catch {
            // ignore invalid JSON
          }
        }
        localStorageRef.setItem(localKey(key), JSON.stringify(value));
        changes[key] = { oldValue, newValue: value };
      }
      if (Object.keys(changes).length > 0) {
        notifyDevStorageListeners(changes);
      }
    },
    async remove(keys) {
      if (!localStorageRef) {
        return;
      }
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const key of normalizeKeys(keys)) {
        let oldValue: unknown = undefined;
        const rawOld = localStorageRef.getItem(localKey(key));
        if (rawOld !== null) {
          try {
            oldValue = JSON.parse(rawOld);
          } catch {
            // ignore invalid JSON
          }
        }
        localStorageRef.removeItem(localKey(key));
        changes[key] = { oldValue, newValue: undefined };
      }
      if (Object.keys(changes).length > 0) {
        notifyDevStorageListeners(changes);
      }
    },
    async clear() {
      if (!localStorageRef) {
        return;
      }
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const key of [SETTINGS_KEY, METRICS_KEY]) {
        let oldValue: unknown = undefined;
        const rawOld = localStorageRef.getItem(localKey(key));
        if (rawOld !== null) {
          try {
            oldValue = JSON.parse(rawOld);
          } catch {
            // ignore invalid JSON
          }
        }
        localStorageRef.removeItem(localKey(key));
        changes[key] = { oldValue, newValue: undefined };
      }
      if (Object.keys(changes).length > 0) {
        notifyDevStorageListeners(changes);
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
      devLog("chrome.storage.onChanged not available; using dev fallback listener.");
      loggedNoChromeListener = true;
    }
    devStorageListeners.add(listener);
    return () => devStorageListeners.delete(listener);
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
  } else if (
    storedSettings.version !== SETTINGS_SCHEMA_VERSION ||
    !Array.isArray(storedSettings.blockedDomains) ||
    typeof storedSettings.activeProfile !== "string" ||
    !storedSettings.profiles
  ) {
    const merged = mergeSettings(storedSettings);
    await storage.set({ [SETTINGS_KEY]: merged });
    devLog("storage.ensureDefaults: settings migrated");
  }
  const storedMetrics = asMetricsCandidate(stored[METRICS_KEY]);
  if (!storedMetrics) {
    await storage.set({ [METRICS_KEY]: DEFAULT_METRICS });
    devLog("storage.ensureDefaults: metrics initialized");
  } else if (storedMetrics.version !== METRICS_SCHEMA_VERSION) {
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
  const next = syncProfiles(mergeSettings(settings));
  await storage.set({ [SETTINGS_KEY]: next });
  devLog("storage.setSettings", {
    blockEnabled: next.blockEnabled,
    blockedDomains: next.blockedDomains.length,
    whitelist: next.whitelist.length
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
  const next = mergeMetrics(metrics);
  await storage.set({ [METRICS_KEY]: next });
  devLog("storage.setMetrics", {
    attemptsByDay: Object.keys(next.attemptsByDay).length,
    timeByDay: Object.keys(next.timeByDay).length
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

function cloneWeekSchedule(input: WeekSchedule): WeekSchedule {
  const next: WeekSchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let day = 0; day <= 6; day += 1) {
    const ranges = input[day] || [];
    next[day] = ranges.map((range) => ({ start: range.start, end: range.end }));
  }
  return next;
}

function cloneIntervalWeek(input: IntervalWeek): IntervalWeek {
  const next: IntervalWeek = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (let day = 0; day <= 6; day += 1) {
    const ranges = input[day] || [];
    next[day] = ranges.map((range) => ({ ...range }));
  }
  return next;
}

function mergeSchedulesWithFallback(input: WeekSchedule | undefined, fallback: WeekSchedule): WeekSchedule {
  const next = cloneWeekSchedule(fallback);
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

function mergeIntervalsByDayWithFallback(
  input: IntervalWeek | undefined,
  fallbackIntervals: IntervalWeek,
  fallbackSchedules?: WeekSchedule
): IntervalWeek {
  if (!input) {
    return fallbackSchedules ? schedulesToIntervals(fallbackSchedules) : cloneIntervalWeek(fallbackIntervals);
  }
  const next = cloneIntervalWeek(fallbackIntervals);
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
      enabled: range.enabled !== false
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

function mergeProfile(input: Partial<ProfileSettings> | undefined, fallback: ProfileSettings): ProfileSettings {
  const blockedDomains = Array.isArray(input?.blockedDomains)
    ? Array.from(
        new Set(
          input.blockedDomains
            .map((domain) => normalizeDomain(domain))
            .filter((domain): domain is string => Boolean(domain))
        )
      )
    : Array.from(fallback.blockedDomains);
  const whitelist = Array.isArray(input?.whitelist)
    ? Array.from(
        new Set(
          input.whitelist
            .map((entry) => normalizeWhitelistEntry(entry))
            .filter((entry): entry is string => Boolean(entry))
        )
      )
    : Array.from(fallback.whitelist);
  const whitelistEnabled = Boolean(input?.whitelistEnabled ?? fallback.whitelistEnabled);
  const blockedDomainsSet = new Set(blockedDomains);
  const blockedDomainTags = normalizeBlockedDomainTags(
    (input?.blockedDomainTags ?? fallback.blockedDomainTags) as Record<string, unknown>,
    blockedDomainsSet
  );
  const schedules = mergeSchedulesWithFallback(input?.schedules, fallback.schedules);
  const intervalsByDay = mergeIntervalsByDayWithFallback(input?.intervalsByDay, fallback.intervalsByDay, schedules);
  const weeklyDays = Array.isArray(input?.weeklyUnblockDays)
    ? Array.from(
        new Set(
          input.weeklyUnblockDays
            .map((day) => Number(day))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )
      ).sort((a, b) => a - b)
    : Array.from(fallback.weeklyUnblockDays);
  const weeklyDuration =
    typeof input?.weeklyUnblockDurationMinutes === "number" &&
    Number.isFinite(input.weeklyUnblockDurationMinutes)
      ? Math.max(1, Math.floor(input.weeklyUnblockDurationMinutes))
      : fallback.weeklyUnblockDurationMinutes;
  const weeklyUntil =
    typeof input?.weeklyUnblockUntil === "number" && Number.isFinite(input.weeklyUnblockUntil)
      ? input.weeklyUnblockUntil
      : fallback.weeklyUnblockUntil;
  const weeklyLastWeek = typeof input?.weeklyUnblockLastWeek === "string" ? input.weeklyUnblockLastWeek : fallback.weeklyUnblockLastWeek;
  const unblockUntil =
    typeof input?.unblockUntil === "number" && Number.isFinite(input.unblockUntil)
      ? input.unblockUntil
      : fallback.unblockUntil;

  return {
    blockEnabled: Boolean(input?.blockEnabled ?? fallback.blockEnabled),
    blockShorts: Boolean(input?.blockShorts ?? fallback.blockShorts),
    blockKids: Boolean(input?.blockKids ?? fallback.blockKids),
    blockInstagramReels: Boolean(input?.blockInstagramReels ?? fallback.blockInstagramReels),
    blockedDomains,
    blockedDomainTags,
    whitelist,
    whitelistEnabled,
    schedules,
    intervalsByDay,
    timeFormat12h: Boolean(input?.timeFormat12h ?? fallback.timeFormat12h),
    unblockUntil,
    weeklyUnblockEnabled: Boolean(input?.weeklyUnblockEnabled ?? fallback.weeklyUnblockEnabled),
    weeklyUnblockDays: weeklyDays,
    weeklyUnblockDurationMinutes: weeklyDuration,
    weeklyUnblockUntil: weeklyUntil,
    weeklyUnblockLastWeek: weeklyLastWeek
  };
}

function toSchemaVersion(value: unknown, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function migrateSettingsV1ToV2(input: Partial<Settings> & Record<string, unknown>) {
  const hasProfiles = Boolean(input.profiles && typeof input.profiles === "object");
  if (hasProfiles) {
    return { ...input, version: 2 };
  }
  const activeProfile: ProfileId = input.activeProfile === "kid" ? "kid" : "adult";
  const adultProfile = mergeProfile(input as Partial<ProfileSettings>, DEFAULT_SETTINGS.profiles.adult);
  return {
    ...input,
    version: 2,
    familyModeEnabled: Boolean(input.familyModeEnabled),
    activeProfile,
    profiles: {
      adult: adultProfile,
      kid: DEFAULT_SETTINGS.profiles.kid
    }
  };
}

function migrateSettingsV2ToV3(input: Partial<Settings> & Record<string, unknown>) {
  const next = { ...input };
  delete next.proEnabled;
  delete next.licenseKey;
  delete next.licenseStatus;
  delete next.licenseCheckedAt;
  delete next.deviceId;
  return {
    ...next,
    version: SETTINGS_SCHEMA_VERSION
  };
}

function migrateSettingsInput(input: Partial<Settings>) {
  let next = { ...input } as Partial<Settings> & Record<string, unknown>;
  let version = toSchemaVersion(next.version, 1);

  if (version < 2) {
    next = migrateSettingsV1ToV2(next);
    version = 2;
  }
  if (version < 3) {
    next = migrateSettingsV2ToV3(next);
  }

  return {
    ...next,
    version: SETTINGS_SCHEMA_VERSION
  } as Partial<Settings> & Record<string, unknown>;
}

function migrateMetricsV1ToV2(input: Partial<Metrics>) {
  return {
    ...input,
    version: METRICS_SCHEMA_VERSION,
    lastAttemptUrl: typeof input.lastAttemptUrl === "string" ? input.lastAttemptUrl : null
  };
}

function migrateMetricsInput(input: Partial<Metrics>) {
  let next = { ...input };
  const version = toSchemaVersion(next.version, 1);
  if (version < METRICS_SCHEMA_VERSION) {
    next = migrateMetricsV1ToV2(next);
  }
  return {
    ...next,
    version: METRICS_SCHEMA_VERSION
  };
}

// Merge de settings, con defaults y validacion basica.
export function mergeSettings(input: Partial<Settings>): Settings {
  const migratedInput = migrateSettingsInput(input);
  const restInput = { ...migratedInput } as Partial<Settings> & Record<string, unknown>;
  delete restInput.proEnabled;
  delete restInput.licenseKey;
  delete restInput.licenseStatus;
  delete restInput.licenseCheckedAt;
  delete restInput.deviceId;
  const pinHash = typeof migratedInput.pinHash === "string" ? migratedInput.pinHash : null;
  const theme = migratedInput.theme === "dark" ? "dark" : migratedInput.theme === "system" ? "system" : "light";
  const familyModeEnabled = Boolean(migratedInput.familyModeEnabled);
  let activeProfile: ProfileId = migratedInput.activeProfile === "kid" ? "kid" : "adult";
  if (!familyModeEnabled) {
    activeProfile = "adult";
  }
  const profilesInput = (migratedInput.profiles && typeof migratedInput.profiles === "object" ? migratedInput.profiles : {}) as Partial<
    Record<ProfileId, Partial<ProfileSettings>>
  >;
  const activeFallback = activeProfile === "kid" ? DEFAULT_SETTINGS.profiles.kid : DEFAULT_SETTINGS.profiles.adult;
  const activeProfileInput = mergeProfile(migratedInput as Partial<ProfileSettings>, activeFallback);
  const adultProfile =
    activeProfile === "adult"
      ? activeProfileInput
      : profilesInput.adult
        ? mergeProfile(profilesInput.adult, DEFAULT_SETTINGS.profiles.adult)
        : DEFAULT_SETTINGS.profiles.adult;
  const kidProfile =
    activeProfile === "kid"
      ? activeProfileInput
      : profilesInput.kid
        ? mergeProfile(profilesInput.kid, DEFAULT_SETTINGS.profiles.kid)
        : DEFAULT_SETTINGS.profiles.kid;
  const activeProfileData = activeProfile === "kid" ? kidProfile : adultProfile;
  return {
    ...DEFAULT_SETTINGS,
    ...restInput,
    ...activeProfileData,
    version: SETTINGS_SCHEMA_VERSION,
    pinHash,
    theme,
    familyModeEnabled,
    activeProfile,
    profiles: {
      adult: adultProfile,
      kid: kidProfile
    }
  };
}

// Merge de metrics v2 con defaults.
export function mergeMetrics(input: Partial<Metrics>): Metrics {
  const migratedInput = migrateMetricsInput(input);
  return {
    ...DEFAULT_METRICS,
    ...migratedInput,
    version: METRICS_SCHEMA_VERSION,
    attemptsByDay: migratedInput.attemptsByDay || DEFAULT_METRICS.attemptsByDay,
    timeByDay: migratedInput.timeByDay || DEFAULT_METRICS.timeByDay,
    blockedTimeByDay: migratedInput.blockedTimeByDay || DEFAULT_METRICS.blockedTimeByDay,
    sessionsByDay: migratedInput.sessionsByDay || DEFAULT_METRICS.sessionsByDay,
    timeByDomainByDay: migratedInput.timeByDomainByDay || DEFAULT_METRICS.timeByDomainByDay,
    lastAttemptUrl:
      typeof migratedInput.lastAttemptUrl === "string" ? migratedInput.lastAttemptUrl : DEFAULT_METRICS.lastAttemptUrl
  };
}
