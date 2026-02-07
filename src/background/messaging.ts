import { DEFAULT_METRICS } from "../domain/settings/defaults";
import { clearDb } from "../infrastructure/db";
import { resetMetrics } from "../infrastructure/storage";
import { computeScheduleTimeline } from "../domain/schedule/timeline";
import { evaluateBlock } from "../domain/blocking/url";
import { addAttempt, addBlockedTime } from "./metrics";
import { ensureMetricsLoaded, ensureSettingsLoaded, getTabState, setMetricsCache, setMetricsDirty, tabStates } from "./state";
import { updateTabTarget } from "./tabs";

// Mensajeria entre content/popup/blocked y background.
export function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void (async () => {
      if (sender.id && sender.id !== chrome.runtime.id) {
        sendResponse({ ok: false, error: "invalid_sender" });
        return;
      }

      const msg = message as { type?: unknown; [key: string]: unknown } | null | undefined;
      const type = typeof msg?.type === "string" ? msg.type : null;
      if (!type) {
        sendResponse({ ok: false, error: "invalid_message" });
        return;
      }

      const hasString = (value: unknown): value is string => typeof value === "string";
      const hasNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
      const hasBoolean = (value: unknown): value is boolean => typeof value === "boolean";

      const isCheckBlock = type === "CHECK_BLOCK" && hasString(msg?.url);
      const isGetTimeline = type === "GET_TIMELINE";
      const isPageHello =
        type === "PAGE_HELLO" && hasString(msg?.url) && (typeof msg?.visible === "undefined" || hasBoolean(msg?.visible));
      const isVisibilityChanged = type === "VISIBILITY_CHANGED" && hasBoolean(msg?.visible);
      const isBlockedTick = type === "BLOCKED_PAGE_TICK" && hasNumber(msg?.deltaSec);
      const isGetLastAttempt = type === "GET_LAST_ATTEMPT" && hasNumber(msg?.tabId);
      const isCloseTab =
        type === "CLOSE_ACTIVE_TAB" && (typeof msg?.tabId === "undefined" || hasNumber(msg?.tabId));
      const isMetricsGet = type === "METRICS_GET";
      const isMetricsReset = type === "METRICS_RESET";

      // Verifica bloqueo por URL.
      if (isCheckBlock) {
        const settings = await ensureSettingsLoaded();
        const decision = evaluateBlock(String(msg?.url), settings, Date.now());
        if (decision.blocked && sender.tab?.id) {
          await addAttempt(sender.tab.id, String(msg?.url), Date.now());
        }
        sendResponse(decision);
        return;
      }

      // Timeline para overlay y popup.
      if (isGetTimeline) {
        const settings = await ensureSettingsLoaded();
        const timeline = computeScheduleTimeline(settings, Date.now());
        sendResponse({ ok: true, timeline });
        return;
      }

      // Handshake desde content (url + visibilidad).
      if (isPageHello) {
        const tabId = sender.tab?.id;
        if (tabId) {
          await updateTabTarget(tabId, String(msg?.url));
          const state = getTabState(tabId);
          state.visible = msg?.visible !== false;
          state.active = Boolean(sender.tab?.active);
          state.lastTick = Date.now();
        }
        sendResponse({ ok: true });
        return;
      }

      // Visibilidad real de la pagina.
      if (isVisibilityChanged) {
        const tabId = sender.tab?.id;
        if (tabId) {
          const state = getTabState(tabId);
          state.visible = Boolean(msg?.visible);
          if (!msg?.visible) {
            state.lastTick = Date.now();
          }
        }
        sendResponse({ ok: true });
        return;
      }

      // Tiempo en pantalla de bloqueo.
      if (isBlockedTick) {
        await addBlockedTime(Number(msg?.deltaSec), Date.now());
        sendResponse({ ok: true });
        return;
      }

      // Permite al blocked.html recuperar la URL intentada (cuando no viene en querystring).
      if (isGetLastAttempt) {
        const state = tabStates.get(Number(msg?.tabId));
        sendResponse({ ok: true, url: state?.lastAttemptUrl ?? null, at: state?.lastAttemptAt ?? null });
        return;
      }

      // Cierra la pestana activa desde blocked.html.
      if (isCloseTab) {
        let tabId = hasNumber(msg?.tabId) ? Number(msg?.tabId) : sender.tab?.id;
        if (!tabId) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          tabId = tabs?.[0]?.id;
        }
        if (tabId) {
          await chrome.tabs.remove(tabId);
        }
        sendResponse({ ok: true });
        return;
      }

      // API simple para dashboard.
      if (isMetricsGet) {
        const metrics = await ensureMetricsLoaded();
        sendResponse({ ok: true, metrics });
        return;
      }

      // Reset total de metricas y DB.
      if (isMetricsReset) {
        await resetMetrics();
        await clearDb();
        setMetricsCache(DEFAULT_METRICS);
        setMetricsDirty(false);
        sendResponse({ ok: true });
        return;
      }

      // Mensaje no manejado.
      sendResponse({ ok: false, error: "unknown_message" });
    })().catch((e) => {
      sendResponse({ ok: false, error: String(e) });
    });

    return true;
  });
}
