// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_METRICS, DEFAULT_SETTINGS } from "../domain/settings/defaults";
import type { Metrics, Settings } from "../domain/settings/types";
import { getWeeklySessionDayKey } from "../domain/weekly/weekly";

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
const listeners = new Set<StorageChangeListener>();

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
  listeners.forEach((listener) => listener(changes, "local"));
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
          changes[key] = { oldValue: storageData[key], newValue: value };
          storageData[key] = value;
        }
        emitStorageChanges(changes);
      },
      async remove(keys) {
        const changes: Record<string, chrome.storage.StorageChange> = {};
        for (const key of resolveKeys(keys)) {
          changes[key] = { oldValue: storageData[key], newValue: undefined };
          delete storageData[key];
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
      },
    },
    onChanged: {
      addListener(listener) {
        listeners.add(listener);
      },
      removeListener(listener) {
        listeners.delete(listener);
      },
    },
  },
};

function mountBlockedDom() {
  document.body.textContent = "";
  const nodes: Array<{ tag: "div" | "button"; id: string; type?: "button" }> = [
    { tag: "div", id: "message" },
    { tag: "div", id: "attempts" },
    { tag: "div", id: "last-attempt" },
    { tag: "div", id: "blocked-url" },
    { tag: "div", id: "blocked-url-label" },
    { tag: "button", id: "copy-url-btn", type: "button" },
    { tag: "button", id: "unblock-btn", type: "button" },
    { tag: "button", id: "close-btn", type: "button" },
    { tag: "div", id: "blocked-tag" },
    { tag: "div", id: "blocked-title" },
    { tag: "div", id: "attempts-label" },
    { tag: "div", id: "last-attempt-label" },
    { tag: "div", id: "blocked-reason-label" },
    { tag: "div", id: "blocked-reason" },
    { tag: "div", id: "carryover-note" },
  ];

  nodes.forEach((node) => {
    const element = document.createElement(node.tag);
    element.id = node.id;
    if (node.type && element instanceof HTMLButtonElement) {
      element.type = node.type;
    }
    document.body.appendChild(element);
  });
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function setupState(settings: Settings, metrics: Metrics, urlPath: string) {
  const { setSettings, setMetrics } = await import("../infrastructure/storage");
  await setSettings(settings);
  await setMetrics(metrics);
  window.history.replaceState({}, "", urlPath);
}

async function initBlockedPage() {
  const module = await import("../ui/blocked/app/blockedApp");
  module.initBlockedPage();
  await flushPromises();
}

(globalThis as unknown as { chrome: ChromeStorageMock }).chrome = chromeMock;

describe("blocked app integration", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    listeners.clear();
    await chromeMock.storage.local.clear();
    mountBlockedDom();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("aplica desbloqueo temporal para dominio con tag intervalos", async () => {
    await setupState(
      {
        ...DEFAULT_SETTINGS,
        blockedDomains: ["youtube.com"],
        blockedDomainTags: { "youtube.com": ["intervalos"] },
        strictMode: false,
      },
      { ...DEFAULT_METRICS },
      "/src/ui/blocked/index.html?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc"
    );
    await initBlockedPage();

    const unblockBtn = document.getElementById("unblock-btn") as HTMLButtonElement;
    expect(unblockBtn.disabled).toBe(false);

    const beforeClick = Date.now();
    unblockBtn.click();
    await flushPromises();

    const { getSettings } = await import("../infrastructure/storage");
    const saved = await getSettings();
    expect(saved.unblockUntil).not.toBeNull();
    expect(saved.unblockUntil as number).toBeGreaterThanOrEqual(beforeClick + 5 * 60 * 1000);
    expect(saved.unblockUntil as number).toBeLessThanOrEqual(Date.now() + 5 * 60 * 1000 + 2000);
  });

  it("aplica desbloqueo semanal para dominio con tag por_semana", async () => {
    const durationMinutes = 45;
    await setupState(
      {
        ...DEFAULT_SETTINGS,
        blockedDomains: ["youtube.com"],
        blockedDomainTags: { "youtube.com": ["por_semana"] },
        weeklyUnblockEnabled: true,
        weeklyUnblockDays: [new Date().getDay()],
        weeklyUnblockDurationMinutes: durationMinutes,
        weeklyUnblockLastWeek: null,
        strictMode: false,
      },
      { ...DEFAULT_METRICS },
      "/src/ui/blocked/index.html?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dweekly"
    );
    await initBlockedPage();

    const unblockBtn = document.getElementById("unblock-btn") as HTMLButtonElement;
    expect(unblockBtn.disabled).toBe(false);

    const beforeClick = Date.now();
    unblockBtn.click();
    await flushPromises();

    const { getSettings } = await import("../infrastructure/storage");
    const saved = await getSettings();
    expect(saved.weeklyUnblockUntil).not.toBeNull();
    expect(saved.weeklyUnblockUntil as number).toBeGreaterThanOrEqual(beforeClick + durationMinutes * 60 * 1000);
    expect(saved.weeklyUnblockUntil as number).toBeLessThanOrEqual(Date.now() + durationMinutes * 60 * 1000 + 2000);
    expect(saved.weeklyUnblockLastWeek).toBe(getWeeklySessionDayKey());
  });

  it("usa fallback de metrics.lastAttemptUrl cuando no hay URL resuelta", async () => {
    await setupState(
      {
        ...DEFAULT_SETTINGS,
        blockedDomains: ["youtube.com"],
        blockedDomainTags: { "youtube.com": ["intervalos"] },
        strictMode: false,
      },
      {
        ...DEFAULT_METRICS,
        lastAttemptUrl: "https://youtube.com/watch?v=fallback",
      },
      "/src/ui/blocked/index.html"
    );
    await initBlockedPage();

    const blockedUrlEl = document.getElementById("blocked-url");
    expect(blockedUrlEl?.textContent).toBe("https://youtube.com/watch?v=fallback");
  });
});
