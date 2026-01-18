import { ensureDbReady } from "../infrastructure/db";
import { getSettings } from "../infrastructure/storage";
import { bootstrapContentScripts, reinjectContentScriptIntoOpenTabs, syncRegisteredContentScripts } from "./contentScripts";
import { startBackgroundTasks } from "./backgroundTasks";
import { ensureMetricsLoaded, setMetricsCache, setSettingsCache } from "./state";

// Ciclo de vida del service worker.
export function registerLifecycleListeners() {
  chrome.runtime.onInstalled.addListener(() => {
    void (async () => {
      // Inicializa defaults, DB y content scripts.
      await bootstrapContentScripts();
      await ensureDbReady();
      await ensureMetricsLoaded();
      // Inicia tracking en background.
      startBackgroundTasks();
    })();
  });

  chrome.runtime.onStartup.addListener(() => {
    void (async () => {
      // Repite init al arrancar el navegador.
      await bootstrapContentScripts();
      await ensureDbReady();
      await ensureMetricsLoaded();
      startBackgroundTasks();
    })();
  });

  // Sincroniza cambios de settings/metrics.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    if (changes.settings) {
      void (async () => {
        const settings = await getSettings();
        setSettingsCache(settings);
        await syncRegisteredContentScripts(settings.blockedDomains);
        await reinjectContentScriptIntoOpenTabs(settings.blockedDomains);
      })();
    }
    if (changes.metrics) {
      setMetricsCache(null);
    }
  });
}
