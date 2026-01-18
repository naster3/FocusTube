import React, { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../core/defaults";
import { t } from "../../core/i18n";
import { getSettings, setSettings } from "../../infrastructure/storage";
import { Settings } from "../../core/types";

// Pantalla principal de opciones.
export function Options() {
  // Estado base de UI.
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("");

    // Carga inicial de settings y metrics.
  useEffect(() => {
    void (async () => {
      const stored = await getSettings();
      setLocalSettings(stored);
    })();
  }, []);

    // Sincroniza cambios desde storage.
  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") {
        return;
      }
      if (changes.settings) {
        void (async () => {
          const stored = await getSettings();
          setLocalSettings(stored);
        })();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Mensajes breves en UI.
  const showStatus = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 2000);
  };

  // Guarda settings completos.
  const saveSettings = async (next: Settings, message?: string) => {
    setLocalSettings(next);
    await setSettings(next);
    if (message) {
      showStatus(message);
    }
  };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "focus-tube-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSettings = async (file: File | null) => {
    if (!file) {
      return;
    }
    const text = await file.text();
    try {
      const data = JSON.parse(text);
      const next = normalizeSettings(data);
      await saveSettings(next, t(settings.language, "options.import.success"));
    } catch {
      setStatus(t(settings.language, "options.import.invalid"));
    }
  };

  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";

  return (
    <div className="options">
      <header className="options-header">
        <h1>FocusTube Blocker</h1>
        <p>{t(settings.language, "options.subtitle")}</p>
        <nav className="options-nav">
          <a href={optionsHref}>{t(settings.language, "nav.config")}</a>
          <a href={dashboardHref}>{t(settings.language, "nav.dashboard")}</a>
          <a href={helpHref}>{t(settings.language, "nav.help")}</a>
        </nav>
      </header>

      {status ? <div className="status">{status}</div> : null}

      <section className="panel">
        <h3>{t(settings.language, "options.blocks.title")}</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.blockShorts}
            onChange={(event) => saveSettings({ ...settings, blockShorts: event.target.checked })}
          />
          {t(settings.language, "options.blocks.shorts")}
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.blockKids}
            onChange={(event) => saveSettings({ ...settings, blockKids: event.target.checked })}
          />
          {t(settings.language, "options.blocks.kids")}
        </label>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "options.permanent.title")}</h3>
        <p>{t(settings.language, "options.permanent.desc")}</p>
        <label>
          <input
            type="checkbox"
            checked={settings.blockEnabled}
            onChange={(event) => saveSettings({ ...settings, blockEnabled: event.target.checked })}
          />
          {t(settings.language, "options.permanent.enable")}
        </label>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "options.time.title")}</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.timeFormat12h}
            onChange={(event) => saveSettings({ ...settings, timeFormat12h: event.target.checked })}
          />
          {t(settings.language, "options.time.use12h")}
        </label>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "options.language.title")}</h3>
        <label>
          <span>{t(settings.language, "options.language.current")}</span>
          <select
            value={settings.language}
            onChange={(event) =>
              saveSettings({ ...settings, language: event.target.value as Settings["language"] })
            }
          >
            <option value="en">English</option>
            <option value="es">Espanol</option>
          </select>
        </label>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "options.export.title")}</h3>
        <div className="actions">
          <button onClick={exportSettings}>{t(settings.language, "options.export.export_json")}</button>
          <label className="import">
            {t(settings.language, "options.export.import_json")}
            <input
              type="file"
              accept="application/json"
              onChange={(event) => importSettings(event.target.files?.[0] || null)}
            />
          </label>
        </div>
      </section>

    </div>
  );
}

// Normaliza settings importados contra defaults.
function normalizeSettings(data: Partial<Settings>): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...data,
    language: data.language === "en" || data.language === "es" ? data.language : DEFAULT_SETTINGS.language,
    schedules: data.schedules || DEFAULT_SETTINGS.schedules,
    intervalsByDay: data.intervalsByDay || DEFAULT_SETTINGS.intervalsByDay,
    whitelist: Array.isArray(data.whitelist) ? data.whitelist : DEFAULT_SETTINGS.whitelist,
    blockedDomains: Array.isArray(data.blockedDomains)
      ? data.blockedDomains
      : DEFAULT_SETTINGS.blockedDomains
  };
  return merged;
}

