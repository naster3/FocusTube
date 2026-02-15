import { beforeEach, describe, expect, it } from "vitest";
import { getMetrics, getSettings, onStorageChanged, updateMetrics, updateSettings } from "../infrastructure/storage";

type StorageChangeListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;

type ChromeStorageMock = {
  storage: {
    local: {
      get: (keys?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
    onChanged: {
      addListener: (listener: StorageChangeListener) => void;
      removeListener: (listener: StorageChangeListener) => void;
    };
  };
};

const storageData: Record<string, unknown> = {};
const storageListeners = new Set<StorageChangeListener>();

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

function emitStorageChanges(changes: Record<string, chrome.storage.StorageChange>) {
  storageListeners.forEach((listener) => {
    listener(changes, "local");
  });
}

const chromeMock: ChromeStorageMock = {
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
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const [key, value] of Object.entries(items)) {
          const oldValue = storageData[key];
          storageData[key] = value;
          changes[key] = { oldValue, newValue: value };
        }
        emitStorageChanges(changes);
      },
      async remove(keys) {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const key of resolveKeys(keys)) {
          const oldValue = storageData[key];
          delete storageData[key];
          changes[key] = { oldValue, newValue: undefined };
        }
        emitStorageChanges(changes);
      },
      async clear() {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const key of Object.keys(storageData)) {
          changes[key] = { oldValue: storageData[key], newValue: undefined };
          delete storageData[key];
        }
        emitStorageChanges(changes);
      }
    },
    onChanged: {
      addListener(listener) {
        storageListeners.add(listener);
      },
      removeListener(listener) {
        storageListeners.delete(listener);
      }
    }
  }
};

(globalThis as unknown as { chrome: ChromeStorageMock }).chrome = chromeMock;

beforeEach(async () => {
  storageListeners.clear();
  await chromeMock.storage.local.clear();
});

describe("storage sync integration", () => {
  it("propaga cambios de settings y metrics a listeners de paginas distintas", async () => {
    const pageA = { settingsEvents: 0, metricsEvents: 0 };
    const pageB = { settingsEvents: 0, metricsEvents: 0 };

    const unsubscribeA = onStorageChanged((changes, area) => {
      if (area !== "local") {
        return;
      }
      if (changes.settings) {
        pageA.settingsEvents += 1;
      }
      if (changes.metrics) {
        pageA.metricsEvents += 1;
      }
    });

    const unsubscribeB = onStorageChanged((changes, area) => {
      if (area !== "local") {
        return;
      }
      if (changes.settings) {
        pageB.settingsEvents += 1;
      }
      if (changes.metrics) {
        pageB.metricsEvents += 1;
      }
    });

    await updateSettings({ language: "es", blockEnabled: true });
    await updateMetrics({ lastAttemptUrl: "https://youtube.com/watch?v=sync" });

    expect(pageA).toEqual({ settingsEvents: 1, metricsEvents: 1 });
    expect(pageB).toEqual({ settingsEvents: 1, metricsEvents: 1 });

    const settings = await getSettings();
    const metrics = await getMetrics();
    expect(settings.language).toBe("es");
    expect(settings.blockEnabled).toBe(true);
    expect(metrics.lastAttemptUrl).toBe("https://youtube.com/watch?v=sync");

    unsubscribeA();
    unsubscribeB();
  });
});
