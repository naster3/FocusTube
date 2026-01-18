import { getMetrics, getSettings } from "../infrastructure/storage";
import type { Metrics, Settings } from "../core/types";

// Estado en memoria por pestana para tracking de tiempo.
export type TabState = {
  domain: string | null;
  isTarget: boolean;
  active: boolean;
  visible: boolean;
  lastTick: number | null;
  lastActiveAt: number | null;
  sessionActive: boolean;
  lastAttemptAt: number | null;
  lastAttemptUrl: string | null;
};

// Cache y estado global del service worker.
export const tabStates = new Map<number, TabState>();
let activeTabId: number | null = null;
let windowFocused = true;
let settingsCache: Settings | null = null;
let metricsCache: Metrics | null = null;
let metricsDirty = false;
let backgroundStarted = false;

// Lee o inicializa el estado por pestana.
export function getTabState(tabId: number): TabState {
  const existing = tabStates.get(tabId);
  if (existing) return existing;

  const next: TabState = {
    domain: null,
    isTarget: false,
    active: false,
    visible: true,
    lastTick: null,
    lastActiveAt: null,
    sessionActive: false,
    lastAttemptAt: null,
    lastAttemptUrl: null
  };
  tabStates.set(tabId, next);
  return next;
}

// Caches perezosos de settings/metrics.
export async function ensureSettingsLoaded() {
  if (!settingsCache) {
    settingsCache = await getSettings();
  }
  return settingsCache;
}

// Caches perezosos de settings/metrics.
export async function ensureMetricsLoaded() {
  if (!metricsCache) {
    metricsCache = await getMetrics();
  }
  return metricsCache;
}

// Getters/setters de estado global.
export function getActiveTabId() {
  return activeTabId;
}

export function setActiveTabId(next: number | null) {
  activeTabId = next;
}

// Foco de ventana para pausar tracking.
export function isWindowFocused() {
  return windowFocused;
}

export function setWindowFocused(next: boolean) {
  windowFocused = next;
}

// Cache de settings.
export function getSettingsCache() {
  return settingsCache;
}

export function setSettingsCache(next: Settings | null) {
  settingsCache = next;
}

// Cache de metrics.
export function getMetricsCache() {
  return metricsCache;
}

export function setMetricsCache(next: Metrics | null) {
  metricsCache = next;
}

// Flag de metrics pendientes.
export function isMetricsDirty() {
  return metricsDirty;
}

export function setMetricsDirty(next: boolean) {
  metricsDirty = next;
}

// Flag para evitar doble inicio.
export function isBackgroundStarted() {
  return backgroundStarted;
}

export function setBackgroundStarted(next: boolean) {
  backgroundStarted = next;
}
