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
        sendResponse({ ok: false });
        return;
      }

      // Verifica bloqueo por URL.
      if (message?.type === "CHECK_BLOCK" && typeof message.url === "string") {
        const settings = await ensureSettingsLoaded();
        const decision = evaluateBlock(message.url, settings, Date.now());
        if (decision.blocked && sender.tab?.id) {
          await addAttempt(sender.tab.id, message.url, Date.now());
        }
        sendResponse(decision);
        return;
      }

      // Timeline para overlay y popup.
      if (message?.type === "GET_TIMELINE") {
        const settings = await ensureSettingsLoaded();
        const timeline = computeScheduleTimeline(settings, Date.now());
        sendResponse({ ok: true, timeline });
        return;
      }

      // Handshake desde content (url + visibilidad).
      if (message?.type === "PAGE_HELLO") {
        const tabId = sender.tab?.id;
        if (tabId && typeof message.url === "string") {
          await updateTabTarget(tabId, message.url);
          const state = getTabState(tabId);
          state.visible = message.visible !== false;
          state.active = Boolean(sender.tab?.active);
          state.lastTick = Date.now();
        }
        sendResponse({ ok: true });
        return;
      }

      // Visibilidad real de la pagina.
      if (message?.type === "VISIBILITY_CHANGED") {
        const tabId = sender.tab?.id;
        if (tabId && typeof message.visible === "boolean") {
          const state = getTabState(tabId);
          state.visible = message.visible;
          if (!message.visible) {
            state.lastTick = Date.now();
          }
        }
        sendResponse({ ok: true });
        return;
      }

      // Tiempo en pantalla de bloqueo.
      if (message?.type === "BLOCKED_PAGE_TICK" && typeof message.deltaSec === "number") {
        await addBlockedTime(message.deltaSec, Date.now());
        sendResponse({ ok: true });
        return;
      }

      // Permite al blocked.html recuperar la URL intentada (cuando no viene en querystring).
      if (message?.type === "GET_LAST_ATTEMPT" && typeof message.tabId === "number") {
        const state = tabStates.get(message.tabId);
        sendResponse({ ok: true, url: state?.lastAttemptUrl ?? null, at: state?.lastAttemptAt ?? null });
        return;
      }

      // Cierra la pestana activa desde blocked.html.
      if (message?.type === "CLOSE_ACTIVE_TAB") {
        let tabId = typeof message.tabId === "number" ? message.tabId : sender.tab?.id;
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
      if (message?.type === "METRICS_GET") {
        const metrics = await ensureMetricsLoaded();
        sendResponse({ ok: true, metrics });
        return;
      }

      // Reset total de metricas y DB.
      if (message?.type === "METRICS_RESET") {
        await resetMetrics();
        await clearDb();
        setMetricsCache(DEFAULT_METRICS);
        setMetricsDirty(false);
        sendResponse({ ok: true });
        return;
      }

      // Mensaje no manejado.
      sendResponse({ ok: false });
    })().catch((e) => {
      sendResponse({ ok: false, error: String(e) });
    });

    return true;
  });
}
