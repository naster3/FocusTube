import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../domain/settings/defaults";
import type { Settings } from "../domain/settings/types";
import { ensureDefaults, getSettings, mergeMetrics, mergeSettings } from "../infrastructure/storage";

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

describe("storage contract", () => {
  it("normalizes settings input during merge", () => {
    const input: Partial<Settings> = {
      blockedDomains: ["YouTube.com", "http://tiktok.com", "   "],
      blockedDomainTags: {
        "youtube.com": ["intervalos", "bad"],
        "bad.com": ["intervalos"]
      } as unknown as Settings["blockedDomainTags"],
      whitelist: ["@Focus", "https://www.youtube.com/channel/ABC", "https://example.com"],
      weeklyUnblockDays: [6, "2" as unknown as number, 9, -1],
      weeklyUnblockDurationMinutes: -3,
      familyModeEnabled: true,
      activeProfile: "kid"
    };

    const merged = mergeSettings(input);
    expect(merged.blockedDomains).toEqual(["youtube.com", "tiktok.com"]);
    expect(merged.blockedDomainTags).toEqual({ "youtube.com": ["intervalos"] });
    expect(merged.whitelist).toEqual(["@focus", "https://www.youtube.com/channel/abc"]);
    expect(merged.weeklyUnblockDays).toEqual([2, 6]);
    expect(merged.weeklyUnblockDurationMinutes).toBe(1);
    expect(merged.familyModeEnabled).toBe(true);
    expect(merged.activeProfile).toBe("kid");
  });

  it("forces metrics version 2 on merge", () => {
    const merged = mergeMetrics({ version: 1, attemptsByDay: { "2024-01-01": 3 } });
    expect(merged.version).toBe(2);
    expect(merged.attemptsByDay["2024-01-01"]).toBe(3);
  });

  it("migrates legacy settings structure on ensureDefaults", async () => {
    await chrome.storage.local.set({
      settings: {
        blockedDomains: ["youtube.com"]
      }
    });

    await ensureDefaults();
    const settings = await getSettings();

    expect(settings.blockedDomains).toEqual(["youtube.com"]);
    expect(settings.activeProfile).toBe("adult");
    expect(settings.profiles.adult.blockedDomains).toEqual(["youtube.com"]);
    expect(settings.profiles.kid).toEqual(DEFAULT_SETTINGS.profiles.kid);
  });
});
