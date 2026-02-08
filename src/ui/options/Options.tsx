import React, { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../domain/settings/defaults";
import { t, tf } from "../../shared/i18n";
import { isDomainTag } from "../../domain/blocking/tags";
import { formatDuration } from "../../domain/schedule/timeline";
import { canStartWeeklySession, getWeeklySessionDayKey, getWeeklySessionDurationMs, isWeeklySessionActive } from "../../domain/weekly/weekly";
import { getSettings, onStorageChanged, setSettings } from "../../infrastructure/storage";
import { DomainTag, Settings } from "../../domain/settings/types";
import { normalizeDomain, normalizeWhitelistEntry } from "../../domain/blocking/url";
import { devLog } from "../../shared/devLogger";

// Pantalla principal de opciones.
export function Options() {
  // Estado base de UI.
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState("");
  const [guideActive, setGuideActive] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [guideSeen, setGuideSeen] = useState(false);
  const [guideReady, setGuideReady] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const readGuideSeen = async () => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get("onboardingSeen");
        return Boolean(stored.onboardingSeen);
      }
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem("onboardingSeen") === "1";
    } catch {
      return false;
    }
  };

  const writeGuideSeen = async (value: boolean) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ onboardingSeen: value });
        return;
      }
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem("onboardingSeen", value ? "1" : "0");
    } catch {
      // ignore
    }
  };

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
    return onStorageChanged(listener);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = await readGuideSeen();
      if (cancelled) {
        return;
      }
      setGuideSeen(seen);
      setGuideActive(!seen);
      setGuideReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  const setLanguage = (language: Settings["language"]) => {
    void saveSettings({ ...settings, language });
  };


  const getDomainOrigins = (domain: string) => [`*://${domain}/*`, `*://*.${domain}/*`];

  const requestDomainPermission = async (domains: string[]) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) {
      devLog("chrome.permissions.request not available; skipping permission prompt (dev only).");
      return true;
    }
    return await new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: domains.flatMap(getDomainOrigins) }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  };

  const removeDomainPermissions = async (domains: string[]) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.remove) {
      devLog("chrome.permissions.remove not available; skipping permission cleanup (dev only).");
      return;
    }
    await new Promise<void>((resolve) => {
      chrome.permissions.remove({ origins: domains.flatMap(getDomainOrigins) }, () => resolve());
    });
  };

  const socialBlocks = [
    { key: "tiktok", label: t(settings.language, "options.blocks.tiktok"), domains: ["tiktok.com"] },
    { key: "instagram", label: t(settings.language, "options.blocks.instagram"), domains: ["instagram.com"] },
    { key: "facebook", label: t(settings.language, "options.blocks.facebook"), domains: ["facebook.com"] },
    { key: "x", label: t(settings.language, "options.blocks.x"), domains: ["x.com", "twitter.com"] }
  ];

  const toggleSocialBlock = async (domains: string[], enabled: boolean) => {
    const tag: DomainTag = "intervalos";
    if (enabled) {
      const granted = await requestDomainPermission(domains);
      if (!granted) {
        showStatus(t(settings.language, "options.blocks.permission_denied"));
        return;
      }
      const nextDomains = Array.from(new Set([...settings.blockedDomains, ...domains]));
      const nextTags = { ...settings.blockedDomainTags };
      domains.forEach((domain) => {
        const current = nextTags[domain] ?? [];
        const next = Array.from(new Set([...current, tag]));
        nextTags[domain] = next;
      });
      await saveSettings({ ...settings, blockedDomains: nextDomains, blockedDomainTags: nextTags });
      return;
    }
    const nextTags = { ...settings.blockedDomainTags };
    const remainingDomains = new Set(settings.blockedDomains);
    const removed: string[] = [];
    domains.forEach((domain) => {
      const current = nextTags[domain] ?? [];
      const next = current.filter((entry) => entry !== tag);
      if (next.length > 0) {
        nextTags[domain] = next;
        return;
      }
      delete nextTags[domain];
      if (remainingDomains.delete(domain)) {
        removed.push(domain);
      }
    });
    await saveSettings({ ...settings, blockedDomains: Array.from(remainingDomains), blockedDomainTags: nextTags });
    if (removed.length > 0) {
      await removeDomainPermissions(removed);
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
  const dayOptionsByLang: Record<Settings["language"], { value: number; label: string }[]> = {
    es: [
      { value: 0, label: "Dom" },
      { value: 1, label: "Lun" },
      { value: 2, label: "Mar" },
      { value: 3, label: "Mie" },
      { value: 4, label: "Jue" },
      { value: 5, label: "Vie" },
      { value: 6, label: "Sab" }
    ],
    en: [
      { value: 0, label: "Sun" },
      { value: 1, label: "Mon" },
      { value: 2, label: "Tue" },
      { value: 3, label: "Wed" },
      { value: 4, label: "Thu" },
      { value: 5, label: "Fri" },
      { value: 6, label: "Sat" }
    ],
    pt: [
      { value: 0, label: "Dom" },
      { value: 1, label: "Seg" },
      { value: 2, label: "Ter" },
      { value: 3, label: "Qua" },
      { value: 4, label: "Qui" },
      { value: 5, label: "Sex" },
      { value: 6, label: "Sáb" }
    ],
    fr: [
      { value: 0, label: "Dim" },
      { value: 1, label: "Lun" },
      { value: 2, label: "Mar" },
      { value: 3, label: "Mer" },
      { value: 4, label: "Jeu" },
      { value: 5, label: "Ven" },
      { value: 6, label: "Sam" }
    ]
  };
  const dayOptions = dayOptionsByLang[settings.language] ?? dayOptionsByLang.en;

  const guideSteps = [
    {
      id: "nav",
      target: "nav",
      title: t(settings.language, "options.guide.step.nav.title"),
      desc: t(settings.language, "options.guide.step.nav.desc")
    },
    {
      id: "blocks",
      target: "blocks",
      title: t(settings.language, "options.guide.step.blocks.title"),
      desc: t(settings.language, "options.guide.step.blocks.desc")
    },
    {
      id: "permanent",
      target: "permanent",
      title: t(settings.language, "options.guide.step.permanent.title"),
      desc: t(settings.language, "options.guide.step.permanent.desc")
    },
    {
      id: "time",
      target: "time",
      title: t(settings.language, "options.guide.step.time.title"),
      desc: t(settings.language, "options.guide.step.time.desc")
    },
    {
      id: "language",
      target: "language",
      title: t(settings.language, "options.guide.step.language.title"),
      desc: t(settings.language, "options.guide.step.language.desc")
    },
    {
      id: "export",
      target: "export",
      title: t(settings.language, "options.guide.step.export.title"),
      desc: t(settings.language, "options.guide.step.export.desc")
    }
  ];

  const guideStep = guideSteps[guideStepIndex];
  const totalGuideSteps = guideSteps.length;

  useEffect(() => {
    if (!guideActive || !guideStep) {
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-guide="${guideStep.target}"]`);
    if (!el) {
      return;
    }
    el.classList.add("guide-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => {
      el.classList.remove("guide-highlight");
    };
  }, [guideActive, guideStep]);

  const startGuide = () => {
    setGuideStepIndex(0);
    setGuideActive(true);
  };

  const finishGuide = async () => {
    setGuideActive(false);
    setGuideStepIndex(0);
    setGuideSeen(true);
    await writeGuideSeen(true);
  };

  const skipGuide = async () => {
    await finishGuide();
  };

  const restartGuide = async () => {
    await writeGuideSeen(false);
    setGuideSeen(false);
    setGuideStepIndex(0);
    setGuideActive(true);
  };

  const dismissGuide = async () => {
    setGuideActive(false);
    setGuideSeen(true);
    await writeGuideSeen(true);
  };

  const now = Date.now();
  const weeklyActive = isWeeklySessionActive(settings, now);
  const canStartWeekly = canStartWeeklySession(settings, now);
  const allowedDays = settings.weeklyUnblockDays ?? [];
  const today = new Date(now).getDay();
  const allowedToday = allowedDays.includes(today);
  const dayLabelByValue = Object.fromEntries(dayOptions.map((day) => [day.value, day.label]));
  const nextAllowedLabel = (() => {
    if (allowedDays.length == 0) {
      return null;
    }
    for (let offset = 1; offset <= 7; offset += 1) {
      const day = (today + offset) % 7;
      if (allowedDays.includes(day)) {
        return dayLabelByValue[day] ?? null;
      }
    }
    return null;
  })();
  let weeklyStatusText = t(settings.language, "options.weekly_unblock.status.disabled");
  let weeklyStatusTone: "active" | "warn" | "muted" = "muted";
  const startWeeklySession = async () => {
    const start = Date.now();
    const until = start + getWeeklySessionDurationMs(settings);
    await saveSettings(
      { ...settings, weeklyUnblockUntil: until, weeklyUnblockLastWeek: getWeeklySessionDayKey(start) },
      t(settings.language, "options.weekly_unblock.started")
    );
  };

  if (!settings.weeklyUnblockEnabled) {
    weeklyStatusText = t(settings.language, "options.weekly_unblock.status.disabled");
  } else if (allowedDays.length == 0) {
    weeklyStatusText = t(settings.language, "options.weekly_unblock.status.no_days");
    weeklyStatusTone = "warn";
  } else if (weeklyActive && settings.weeklyUnblockUntil) {
    weeklyStatusText = tf(settings.language, "options.weekly_unblock.status.active", {
      duration: formatDuration(settings.weeklyUnblockUntil - now)
    });
    weeklyStatusTone = "active";
  } else if (canStartWeekly) {
    weeklyStatusText = t(settings.language, "options.weekly_unblock.status.available");
    weeklyStatusTone = "active";
  } else if (allowedToday) {
    weeklyStatusText = t(settings.language, "options.weekly_unblock.status.used");
    weeklyStatusTone = "warn";
  } else {
    weeklyStatusText = tf(settings.language, "options.weekly_unblock.status.not_today", {
      day: nextAllowedLabel ?? "-"
    });
  }

  return (
    <div className="options">
      <header className="options-header">
        <h1>FocusTube Blocker</h1>
        <p>{t(settings.language, "options.subtitle")}</p>
        <nav className="options-nav" data-guide="nav">
          <a href={optionsHref}>{t(settings.language, "nav.config")}</a>
          <a href={dashboardHref}>{t(settings.language, "nav.dashboard")}</a>
          <a href={helpHref}>{t(settings.language, "nav.help")}</a>
        </nav>
        <div className="guide-trigger">
          <button type="button" className="btn-ghost" onClick={startGuide} disabled={!guideReady || guideActive}>
            {t(settings.language, "options.guide.show")}
          </button>
        </div>
      </header>

      {!guideSeen || guideActive ? (
        <section className="panel guide-panel">
          <div className="guide-header">
            <div>
              <h3>{t(settings.language, "options.guide.title")}</h3>
              <p className="guide-sub">{t(settings.language, "options.guide.subtitle")}</p>
            </div>
            <div className="guide-actions">
              <button onClick={startGuide} disabled={!guideReady || guideActive}>
                {t(settings.language, "options.guide.start")}
              </button>
              {guideSeen ? (
                <button type="button" className="btn-ghost" onClick={restartGuide}>
                  {t(settings.language, "options.guide.restart")}
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={dismissGuide}>
                  {t(settings.language, "options.guide.dismiss")}
                </button>
              )}
            </div>
          </div>
          <ol className="guide-steps">
            <li>{t(settings.language, "options.guide.step1")}</li>
            <li>{t(settings.language, "options.guide.step2")}</li>
            <li>{t(settings.language, "options.guide.step3")}</li>
          </ol>
        </section>
      ) : null}

      {status ? <div className="status">{status}</div> : null}

      <section className="panel blocks-panel" data-guide="blocks">
        <h3>{t(settings.language, "options.blocks.title")}</h3>
        <div className="option-grid">
          <label className="option-toggle option-toggle-lite">
            <input
              type="checkbox"
              checked={settings.blockShorts}
              onChange={(event) => saveSettings({ ...settings, blockShorts: event.target.checked })}
            />
            {t(settings.language, "options.blocks.shorts")}
          </label>
          <label className="option-toggle option-toggle-lite">
            <input
              type="checkbox"
              checked={settings.blockKids}
              onChange={(event) => saveSettings({ ...settings, blockKids: event.target.checked })}
            />
            {t(settings.language, "options.blocks.kids")}
          </label>
          <label className="option-toggle option-toggle-lite">
            <input
              type="checkbox"
              checked={settings.blockInstagramReels}
              onChange={(event) => saveSettings({ ...settings, blockInstagramReels: event.target.checked })}
            />
            {t(settings.language, "options.blocks.instagram_reels")}
          </label>
          {socialBlocks.map((block) => {
            const checked = block.domains.every((domain) => settings.blockedDomains.includes(domain));
            return (
              <label key={block.key} className="option-toggle option-toggle-lite">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggleSocialBlock(block.domains, event.target.checked)}
                />
                {block.label}
              </label>
            );
          })}
        </div>
      </section>

      <section className="panel permanent-panel" data-guide="permanent">
        <h3>{t(settings.language, "options.permanent.title")}</h3>
        <div className="permanent-grid permanent-grid-top">
          <div className="option-stack">
            <p className="option-desc">{t(settings.language, "options.permanent.desc")}</p>
            <label className="option-toggle option-toggle-hero option-accent-red">
              <span className="option-icon" aria-hidden="true" />
              <input
                type="checkbox"
                checked={settings.blockEnabled}
                onChange={(event) => saveSettings({ ...settings, blockEnabled: event.target.checked })}
              />
              <span className="option-text">{t(settings.language, "options.permanent.enable")}</span>
            </label>
          </div>
          <div className="option-stack">
            <p className="option-desc">{t(settings.language, "options.weekly_unblock.desc")}</p>
            <label className="option-toggle option-toggle-hero option-accent-blue">
              <span className="option-icon" aria-hidden="true" />
              <input
                type="checkbox"
                checked={settings.weeklyUnblockEnabled}
                onChange={(event) => saveSettings({ ...settings, weeklyUnblockEnabled: event.target.checked })}
              />
              <span className="option-text">{t(settings.language, "options.weekly_unblock.enable")}</span>
            </label>
          </div>
        </div>
        <div className="divider" />
        <div className="permanent-grid permanent-grid-bottom">
          <div className="weekly-days">
            <span>{t(settings.language, "options.weekly_unblock.days")}</span>
            <div className="weekly-days-list">
              {dayOptions.map((day) => (
                <label key={day.value} className="weekly-day">
                  <input
                    type="checkbox"
                    checked={settings.weeklyUnblockDays.includes(day.value)}
                    onChange={() => {
                      const set = new Set(settings.weeklyUnblockDays);
                      if (set.has(day.value)) {
                        set.delete(day.value);
                      } else {
                        set.add(day.value);
                      }
                      saveSettings({ ...settings, weeklyUnblockDays: Array.from(set).sort((a, b) => a - b) });
                    }}
                  />
                  <span className="weekly-day-label">{day.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="weekly-duration-stack">
            <label className="option-row">
              <span>{t(settings.language, "options.weekly_unblock.duration")}</span>
              <input
                type="number"
                min={1}
                step={1}
                value={settings.weeklyUnblockDurationMinutes}
                onChange={(event) => {
                  const raw = Number(event.target.value);
                  const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
                  saveSettings({ ...settings, weeklyUnblockDurationMinutes: next });
                }}
              />
              <span>{t(settings.language, "options.weekly_unblock.minutes")}</span>
            </label>
            <div className={`weekly-status ${weeklyStatusTone}`}>
              <span className="weekly-status-label">{t(settings.language, "options.weekly_unblock.status.title")}</span>
              <span className="weekly-status-value">{weeklyStatusText}</span>
            </div>
            {settings.weeklyUnblockEnabled && canStartWeekly ? (
              <div className="weekly-actions">
                <button type="button" onClick={startWeeklySession}>
                  {t(settings.language, "options.weekly_unblock.action.start")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel" data-guide="time">
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

      <section className="panel language-panel" data-guide="language">
        <h3>{t(settings.language, "options.language.title")}</h3>
        <div className="language-picker">
          <span className="language-label">{t(settings.language, "options.language.current")}</span>
          <label className="language-option">
            <input
              type="radio"
              name="language"
              value="en"
              checked={settings.language === "en"}
              onChange={() => setLanguage("en")}
            />
            <span>English</span>
          </label>
          <label className="language-option">
            <input
              type="radio"
              name="language"
              value="es"
              checked={settings.language === "es"}
              onChange={() => setLanguage("es")}
            />
            <span>Español</span>
          </label>
          <label className="language-option">
            <input
              type="radio"
              name="language"
              value="pt"
              checked={settings.language === "pt"}
              onChange={() => setLanguage("pt")}
            />
            <span>Português</span>
          </label>
          <label className="language-option">
            <input
              type="radio"
              name="language"
              value="fr"
              checked={settings.language === "fr"}
              onChange={() => setLanguage("fr")}
            />
            <span>Français</span>
          </label>
        </div>
      </section>

      <section className="panel" data-guide="export">
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

      {guideActive && guideStep ? (
        <div className="guide-float" role="dialog" aria-live="polite">
          <div className="guide-progress">
            {tf(settings.language, "options.guide.progress", {
              current: guideStepIndex + 1,
              total: totalGuideSteps
            })}
          </div>
          <div className="guide-title">{guideStep.title}</div>
          <div className="guide-text">{guideStep.desc}</div>
          <div className="guide-nav">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setGuideStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={guideStepIndex === 0}
            >
              {t(settings.language, "options.guide.back")}
            </button>
            {guideStepIndex === totalGuideSteps - 1 ? (
              <button type="button" onClick={finishGuide}>
                {t(settings.language, "options.guide.finish")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGuideStepIndex((prev) => Math.min(totalGuideSteps - 1, prev + 1))}
              >
                {t(settings.language, "options.guide.next")}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={skipGuide}>
              {t(settings.language, "options.guide.skip")}
            </button>
          </div>
        </div>
      ) : null}

      {showScrollTop ? (
        <button
          type="button"
          className="scroll-top-btn"
          title={t(settings.language, "ui.scroll_top")}
          aria-label={t(settings.language, "ui.scroll_top")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ↑
        </button>
      ) : null}

    </div>
  );
}

// Normaliza settings importados contra defaults.
function normalizeBlockedDomainTags(input?: Record<string, unknown>): Record<string, DomainTag[]> {
  if (!input || typeof input !== "object") {
    return {};
  }
  const next: Record<string, DomainTag[]> = {};
  for (const [domain, value] of Object.entries(input)) {
    if (!Array.isArray(value)) {
      continue;
    }
    const tags = value.map((tag) => String(tag)).filter((tag) => isDomainTag(tag));
    const unique = Array.from(new Set(tags));
    if (unique.length > 0) {
      next[domain] = unique;
    }
  }
  return next;
}

function normalizeSettings(data: Partial<Settings>): Settings {
  const blockedDomainTags = normalizeBlockedDomainTags(data.blockedDomainTags as Record<string, unknown>);
  const pinHash = typeof data.pinHash === "string" ? data.pinHash : null;
  const weeklyDays = Array.isArray(data.weeklyUnblockDays)
    ? Array.from(
        new Set(
          data.weeklyUnblockDays
            .map((day) => Number(day))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        )
      ).sort((a, b) => a - b)
    : DEFAULT_SETTINGS.weeklyUnblockDays;
  const weeklyDuration =
    typeof data.weeklyUnblockDurationMinutes === "number" && Number.isFinite(data.weeklyUnblockDurationMinutes)
      ? Math.max(1, Math.floor(data.weeklyUnblockDurationMinutes))
      : DEFAULT_SETTINGS.weeklyUnblockDurationMinutes;
  const weeklyUntil =
    typeof data.weeklyUnblockUntil === "number" && Number.isFinite(data.weeklyUnblockUntil)
      ? data.weeklyUnblockUntil
      : null;
  const weeklyLastWeek = typeof data.weeklyUnblockLastWeek === "string" ? data.weeklyUnblockLastWeek : null;
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...data,
    pinHash,
    weeklyUnblockEnabled: Boolean(data.weeklyUnblockEnabled),
    blockInstagramReels: Boolean(data.blockInstagramReels),
    weeklyUnblockDays: weeklyDays,
    weeklyUnblockDurationMinutes: weeklyDuration,
    weeklyUnblockUntil: weeklyUntil,
    weeklyUnblockLastWeek: weeklyLastWeek,
    blockedDomainTags,
    language: data.language === "en" || data.language === "es" || data.language === "pt" || data.language === "fr" ? data.language : DEFAULT_SETTINGS.language,
    schedules: data.schedules || DEFAULT_SETTINGS.schedules,
    intervalsByDay: data.intervalsByDay || DEFAULT_SETTINGS.intervalsByDay,
    whitelist: Array.isArray(data.whitelist)
      ? Array.from(
          new Set(
            data.whitelist
              .map((entry) => normalizeWhitelistEntry(entry))
              .filter((entry): entry is string => Boolean(entry))
          )
        )
      : DEFAULT_SETTINGS.whitelist,
    blockedDomains: Array.isArray(data.blockedDomains)
      ? Array.from(
          new Set(
            data.blockedDomains
              .map((domain) => normalizeDomain(domain))
              .filter((domain): domain is string => Boolean(domain))
          )
        )
      : DEFAULT_SETTINGS.blockedDomains
  };
  return merged;
}
