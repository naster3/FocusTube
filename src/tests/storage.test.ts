import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_METRICS, DEFAULT_SETTINGS } from "../core/defaults";
import {
  ensureDefaults,
  getMetrics,
  getSettings,
  incrementAttempt,
  resetMetrics,
  setSettings,
  updateMetrics,
  updateSettings
} from "../infrastructure/storage";

type ChromeStorage = {
  storage: {
    local: {
      get: (keys?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
  };
};

const storageData: Record<string, unknown> = {};

function resolveKeys(keys?: string | string[] | Record<string, unknown>) {
  if (!keys) {
    return Object.keys(storageData);
  }
  if (Array.isArray(keys)) {
    return keys;
  }
  if (typeof keys === "string") {
    return [keys];
  }
  return Object.keys(keys);
}

const chromeMock: ChromeStorage = {
  storage: {
    local: {
      async get(keys) {
        const result: Record<string, unknown> = {};
        for (const key of resolveKeys(keys)) {
          if (key in storageData) {
            result[key] = storageData[key];
          }
        }
        return result;
      },
      async set(items) {
        Object.assign(storageData, items);
      },
      async remove(keys) {
        for (const key of resolveKeys(keys)) {
          delete storageData[key];
        }
      },
      async clear() {
        for (const key of Object.keys(storageData)) {
          delete storageData[key];
        }
      }
    }
  }
};

const globalChrome = globalThis as unknown as { chrome: ChromeStorage };
globalChrome.chrome = chromeMock;

beforeEach(async () => {
  await globalChrome.chrome.storage.local.clear();
});

describe("storage settings", () => {
  it("initializes defaults when storage is empty", async () => {
    await ensureDefaults();
    const settings = await getSettings();
    const metrics = await getMetrics();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(metrics).toEqual(DEFAULT_METRICS);
  });

  it("updates settings without losing existing values", async () => {
    const base = { ...DEFAULT_SETTINGS, blockEnabled: true };
    await setSettings(base);
    await updateSettings({ unblockUntil: 123 });
    const next = await getSettings();
    expect(next.blockEnabled).toBe(true);
    expect(next.unblockUntil).toBe(123);
    expect(next.intervalsByDay).toEqual(base.intervalsByDay);
  });

  it("sanitizes invalid stored settings", async () => {
    await chrome.storage.local.set({
      settings: {
        blockEnabled: true,
        blockedDomains: "nope",
        whitelist: "bad",
        intervalsByDay: {
          1: [
            {
              id: "x",
              start: "10:00",
              end: "11:00",
              mode: "weird",
              enabled: "yes"
            }
          ]
        }
      }
    });
    const settings = await getSettings();
    expect(settings.blockEnabled).toBe(true);
    expect(settings.blockedDomains).toEqual(DEFAULT_SETTINGS.blockedDomains);
    expect(settings.whitelist).toEqual(DEFAULT_SETTINGS.whitelist);
    expect(settings.intervalsByDay[1]?.[0]?.mode).toBe("blocked");
    expect(settings.intervalsByDay[1]?.[0]?.enabled).toBe(true);
  });

  it("builds intervals from schedules when intervals are missing", async () => {
    await chrome.storage.local.set({
      settings: {
        schedules: {
          1: [{ start: "09:00", end: "10:00" }]
        }
      }
    });
    const settings = await getSettings();
    expect(settings.intervalsByDay[1]?.[0]?.start).toBe("09:00");
    expect(settings.intervalsByDay[1]?.[0]?.end).toBe("10:00");
  });
});

describe("storage metrics", () => {
  it("increments attempts and timestamps", async () => {
    await resetMetrics();
    const ts = Date.parse("2024-01-01T10:30:00Z");
    await incrementAttempt(ts);
    const metrics = await getMetrics();
    const dateKey = new Date(ts).toISOString().slice(0, 10);
    expect(metrics.attemptsByDay[dateKey]).toBe(1);
    expect(metrics.lastAttemptAt).toBe(ts);
    expect(metrics.lastUpdatedAt).toBe(ts);
  });

  it("merges metric updates with defaults", async () => {
    await updateMetrics({ timeByDay: { "2024-01-02": 120 } });
    const metrics = await getMetrics();
    expect(metrics.version).toBe(DEFAULT_METRICS.version);
    expect(metrics.timeByDay["2024-01-02"]).toBe(120);
  });

  it("migrates legacy metrics version", async () => {
    await chrome.storage.local.set({
      metrics: {
        version: 1,
        attemptsByDay: { "2024-01-01": 2 }
      }
    });
    await ensureDefaults();
    const metrics = await getMetrics();
    expect(metrics.version).toBe(DEFAULT_METRICS.version);
    expect(metrics.attemptsByDay["2024-01-01"]).toBe(2);
  });
});
