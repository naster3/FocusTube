import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSettings } from "../../infrastructure/storage";
import { DEFAULT_SETTINGS } from "../../domain/settings/defaults";
import { t } from "../../shared/i18n";
import "./help.css";

function Help() {
  const [lang, setLang] = useState(DEFAULT_SETTINGS.language);

  useEffect(() => {
    void (async () => {
      const settings = await getSettings();
      setLang(settings.language);
    })();
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local" || !changes.settings) {
        return;
      }
      void (async () => {
        const settings = await getSettings();
        setLang(settings.language);
      })();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";

  return (
    <div className="options">
      <header className="options-header">
        <h1>FocusTube Blocker</h1>
        <p>{t(lang, "help.subtitle")}</p>
        <nav className="options-nav">
          <a href={optionsHref}>{t(lang, "nav.config")}</a>
          <a href={dashboardHref}>{t(lang, "nav.dashboard")}</a>
          <a href={helpHref}>{t(lang, "nav.help")}</a>
        </nav>
      </header>

      <section className="panel">
        <h3>{t(lang, "nav.help")}</h3>
        <p>{t(lang, "help.intro.line1")}</p>
        <p>{t(lang, "help.intro.line2")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.manual.title")}</h3>
        <p>{t(lang, "help.manual.line1")}</p>
        <p>{t(lang, "help.manual.line2")}</p>
        <p>{t(lang, "help.manual.line3")}</p>
        <p>{t(lang, "help.manual.line4")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.quick_blocks.title")}</h3>
        <p>{t(lang, "help.quick_blocks.line1")}</p>
        <p>{t(lang, "help.quick_blocks.line2")}</p>
        <p>{t(lang, "help.quick_blocks.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.weekly.title")}</h3>
        <p>{t(lang, "help.weekly.line1")}</p>
        <p>{t(lang, "help.weekly.line2")}</p>
        <p>{t(lang, "help.weekly.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.strict.title")}</h3>
        <p>{t(lang, "help.strict.line1")}</p>
        <p>{t(lang, "help.strict.line2")}</p>
        <p>{t(lang, "help.strict.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.temp_unblock.title")}</h3>
        <p>{t(lang, "help.temp_unblock.line1")}</p>
        <p>{t(lang, "help.temp_unblock.line2")}</p>
        <p>{t(lang, "help.temp_unblock.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.schedule.title")}</h3>
        <p>{t(lang, "help.schedule.line1")}</p>
        <p>{t(lang, "help.schedule.line2")}</p>
        <p>{t(lang, "help.schedule.line3")}</p>
        <p>{t(lang, "help.schedule.line4")}</p>
        <p>{t(lang, "help.schedule.line5")}</p>
        <p>{t(lang, "help.schedule.line6")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.permissions.title")}</h3>
        <p>{t(lang, "help.permissions.line1")}</p>
        <p>{t(lang, "help.permissions.line2")}</p>
        <p>{t(lang, "help.permissions.line3")}</p>
        <p>{t(lang, "help.permissions.line4")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.whitelist.title")}</h3>
        <p>{t(lang, "help.whitelist.line1")}</p>
        <p>{t(lang, "help.whitelist.line2")}</p>
        <p>{t(lang, "help.whitelist.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.blocked_page.title")}</h3>
        <p>{t(lang, "help.blocked_page.line1")}</p>
        <p>{t(lang, "help.blocked_page.line2")}</p>
        <p>{t(lang, "help.blocked_page.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.import_export.title")}</h3>
        <p>{t(lang, "help.import_export.line1")}</p>
        <p>{t(lang, "help.import_export.line2")}</p>
        <p>{t(lang, "help.import_export.line3")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.reset.title")}</h3>
        <p>{t(lang, "help.reset.line1")}</p>
        <p>{t(lang, "help.reset.line2")}</p>
        <p>{t(lang, "help.reset.line3")}</p>
        <p>{t(lang, "help.reset.line4")}</p>
        <pre>
          chrome.storage.local.clear()
        </pre>
      </section>

      <section className="panel">
        <h3>{t(lang, "dashboard.metrics.title")}</h3>
        <p>{t(lang, "help.metrics.line1")}</p>
        <p>{t(lang, "help.metrics.line2")}</p>
        <p>{t(lang, "help.metrics.line3")}</p>
        <p>{t(lang, "help.metrics.line4")}</p>
        <p>{t(lang, "help.metrics.line5")}</p>
      </section>

      <section className="panel">
        <h3>{t(lang, "help.troubleshoot.title")}</h3>
        <p>{t(lang, "help.troubleshoot.line1")}</p>
        <p>{t(lang, "help.troubleshoot.line2")}</p>
        <p>{t(lang, "help.troubleshoot.line3")}</p>
      </section>
    </div>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Help />
    </React.StrictMode>
  );
}
