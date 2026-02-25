import { DEFAULT_METRICS } from "../domain/settings/defaults";
import { clearDb } from "../infrastructure/db";
import { resetMetrics } from "../infrastructure/storage";
import { computeScheduleTimeline } from "../domain/schedule/timeline";
import { evaluateBlock } from "../domain/blocking/url";
import { addAttempt, addBlockedTime } from "./metrics";
import {
  ensureMetricsLoaded,
  ensureSettingsLoaded,
  getTabState,
  setMetricsCache,
  setMetricsDirty,
  tabStates,
} from "./state";
import { updateTabTarget } from "./tabs";
import { parseMessage } from "../shared/messages";

// Mensajeria entre content/popup/blocked y background.
export function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void (async () => {
      if (sender.id && sender.id !== chrome.runtime.id) {
        sendResponse({ ok: false, error: "invalid_sender" });
        return;
      }

      const parsed = parseMessage(message, "background");
      if (!parsed) {
        sendResponse({ ok: false, error: "invalid_message" });
        return;
      }

      // Verifica bloqueo por URL.
      if (parsed.type === "CHECK_BLOCK") {
        const settings = await ensureSettingsLoaded();
        const decision = evaluateBlock(parsed.url, settings, Date.now());
        if (decision.blocked && sender.tab?.id) {
          await addAttempt(sender.tab.id, parsed.url, Date.now());
        }
        sendResponse({ ok: true, ...decision });
        return;
      }

      // Timeline para overlay y popup.
      if (parsed.type === "GET_TIMELINE") {
        const settings = await ensureSettingsLoaded();
        const timeline = computeScheduleTimeline(settings, Date.now());
        sendResponse({ ok: true, timeline });
        return;
      }

      // Handshake desde content (url + visibilidad).
      if (parsed.type === "PAGE_HELLO") {
        const tabId = sender.tab?.id;
        if (tabId) {
          await updateTabTarget(tabId, parsed.url);
          const state = getTabState(tabId);
          state.visible = parsed.visible !== false;
          state.active = Boolean(sender.tab?.active);
          state.lastTick = Date.now();
        }
        sendResponse({ ok: true });
        return;
      }

      // Visibilidad real de la pagina.
      if (parsed.type === "VISIBILITY_CHANGED") {
        const tabId = sender.tab?.id;
        if (tabId) {
          const state = getTabState(tabId);
          state.visible = Boolean(parsed.visible);
          if (!parsed.visible) {
            state.lastTick = Date.now();
          }
        }
        sendResponse({ ok: true });
        return;
      }

      // Tiempo en pantalla de bloqueo.
      if (parsed.type === "BLOCKED_PAGE_TICK") {
        await addBlockedTime(parsed.deltaSec, Date.now());
        sendResponse({ ok: true });
        return;
      }

      // Permite al blocked.html recuperar la URL intentada (cuando no viene en querystring).
      if (parsed.type === "GET_LAST_ATTEMPT") {
        const state = tabStates.get(parsed.tabId);
        sendResponse({ ok: true, url: state?.lastAttemptUrl ?? null, at: state?.lastAttemptAt ?? null });
        return;
      }

      // Cierra la pestana activa desde blocked.html.
      if (parsed.type === "CLOSE_ACTIVE_TAB") {
        let tabId = typeof parsed.tabId === "number" ? parsed.tabId : sender.tab?.id;
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
      if (parsed.type === "METRICS_GET") {
        const metrics = await ensureMetricsLoaded();
        sendResponse({ ok: true, metrics });
        return;
      }

      // Reset total de metricas y DB.
      if (parsed.type === "METRICS_RESET") {
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
