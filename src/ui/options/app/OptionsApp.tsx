import React, { useEffect, useMemo, useState } from "react";
import { t, tf } from "../../../shared/i18n";
import { formatDuration } from "../../../domain/schedule/timeline";
import {
  canStartWeeklySession,
  getWeeklySessionDayKey,
  getWeeklySessionDurationMs,
  isWeeklySessionActive,
} from "../../../domain/weekly/weekly";
import { EXPORT_SIGNATURE, EXPORT_VERSION } from "../../../domain/exports/constants";
import { buildExportPayload } from "../../../domain/exports/payload";
import type { ExportFormat, ExportType } from "../../../domain/exports/types";
import {
  getMetrics,
  getSettings,
  mergeMetrics,
  mergeSettings,
  setMetrics,
  setSettings,
} from "../../../infrastructure/storage";
import { DomainTag, Metrics, Settings } from "../../../domain/settings/types";
import { devLog } from "../../../shared/devLogger";
import { switchProfile } from "../../../domain/settings/profiles";
import { openHumanPdf } from "../exporters/humanPdf";
import { buildBackupSheets, buildSettingsSheets } from "../exporters/humanExcel";
import {
  downloadCsv,
  downloadJson,
  downloadXlsx,
  extractRawJson,
  flattenRecord,
  parseCsv,
  readRawJsonFromExcel,
} from "../utils/exportUtils";
import { OptionsHeader } from "../../shared/OptionsHeader";
import { useThemeSync } from "../../shared/hooks/useThemeSync";
import { useOnboardingGuide } from "../../shared/hooks/useOnboardingGuide";
import { useSettingsSync } from "../../shared/hooks/useSettingsSync";
import { getDayOptions } from "../../../shared/i18n/dates";
import { BlocksPanel, SocialBlock } from "../components/BlocksPanel";
import { PermanentPanel } from "../components/PermanentPanel";
import { TimePanel } from "../components/TimePanel";
import { ThemePanel } from "../components/ThemePanel";
import { LanguagePanel } from "../components/LanguagePanel";
import { FamilyPanel } from "../components/FamilyPanel";
import { DataPanel } from "../components/DataPanel";
import { GuidePanel } from "../components/GuidePanel";
import { GuideFloat } from "../components/GuideFloat";

const SHOW_FAMILY_PANEL = false;

// Pantalla principal de opciones.
export function Options() {
  // Estado base de UI.
  const { settings, setSettings: setLocalSettings } = useSettingsSync();
  const [status, setStatus] = useState("");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [settingsExportFormat, setSettingsExportFormat] = useState<ExportFormat>("json");
  const [backupExportFormat, setBackupExportFormat] = useState<ExportFormat>("json");

  useThemeSync(settings.theme);

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

  const toggleFamilyMode = async (enabled: boolean) => {
    if (!enabled) {
      const next = switchProfile(settings, "adult");
      await saveSettings({ ...next, familyModeEnabled: false });
      return;
    }
    await saveSettings({ ...settings, familyModeEnabled: true });
  };

  const selectProfile = async (profileId: "adult" | "kid") => {
    if (!settings.familyModeEnabled) {
      return;
    }
    const next = switchProfile(settings, profileId);
    await saveSettings(next);
  };

  const setLanguage = (language: Settings["language"]) => {
    void saveSettings({ ...settings, language });
  };

  const setTheme = (theme: Settings["theme"]) => {
    void saveSettings({ ...settings, theme });
  };

  const getDomainOrigins = (domain: string) => [`*://${domain}/*`, `*://*.${domain}/*`];

  const requestDomainPermission = async (domains: string[]) => {
    // Los dominios sociales usan permisos opcionales para no pedir acceso amplio desde la instalacion.
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

  const socialBlocks: SocialBlock[] = [
    {
      key: "tiktok",
      label: t(settings.language, "options.blocks.tiktok"),
      domains: ["tiktok.com"],
      desc: "tiktok.com",
      icon: "TT",
      tone: "pink",
    },
    {
      key: "instagram",
      label: t(settings.language, "options.blocks.instagram"),
      domains: ["instagram.com"],
      desc: "instagram.com",
      icon: "IG",
      tone: "purple",
    },
    {
      key: "facebook",
      label: t(settings.language, "options.blocks.facebook"),
      domains: ["facebook.com"],
      desc: "facebook.com",
      icon: "FB",
      tone: "blue",
    },
    {
      key: "x",
      label: t(settings.language, "options.blocks.x"),
      domains: ["x.com", "twitter.com"],
      desc: "x.com / twitter.com",
      icon: "X",
      tone: "slate",
    },
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
    // Quitamos solo el tag de este origen; si otro flujo sigue usando el dominio, no se elimina.
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

  const toggleAllBlocks = async (enabled: boolean) => {
    await saveSettings({
      ...settings,
      blockShorts: enabled,
      blockKids: enabled,
      blockInstagramReels: enabled,
    });
    for (const block of socialBlocks) {
      await toggleSocialBlock(block.domains, enabled);
    }
  };

  const exportData = async (kind: ExportType, format: ExportFormat) => {
    if (kind === "settings") {
      const currentSettings = await getSettings();
      const payload = buildExportPayload("settings", currentSettings);
      if (format === "json") {
        downloadJson(payload, "focus-tube-settings.json");
        return;
      }
      if (format === "csv") {
        const rows = [
          { key: "__raw_json__", value: JSON.stringify(payload) },
          ...flattenRecord(currentSettings as Record<string, unknown>),
        ];
        downloadCsv(rows, "focus-tube-settings.csv");
        return;
      }
      if (format === "excel") {
        downloadXlsx(buildSettingsSheets(currentSettings, true, payload), "focus-tube-settings.xlsx");
        return;
      }
      const opened = openHumanPdf({
        title: `FocusTube - ${t(currentSettings.language, "options.data.settings_title")}`,
        settings: currentSettings,
        metrics: null,
        language: currentSettings.language,
      });
      if (!opened) {
        showStatus(t(settings.language, "options.data.pdf_blocked"));
      }
      return;
    }
    const [currentSettings, currentMetrics] = await Promise.all([getSettings(), getMetrics()]);
    // El backup guarda estado funcional completo para poder restaurar la extension en otro navegador.
    const payload = {
      version: 1,
      createdAt: new Date().toISOString(),
      settings: currentSettings,
      metrics: currentMetrics,
    };
    const exportPayload = buildExportPayload("backup", payload);
    if (format === "json") {
      downloadJson(exportPayload, "focus-tube-backup.json");
      return;
    }
    if (format === "csv") {
      const settingsRows = flattenRecord(currentSettings as Record<string, unknown>);
      const metricsRows = flattenRecord(currentMetrics as Record<string, unknown>);
      const rows = [
        { section: "meta", key: "__raw_json__", value: JSON.stringify(exportPayload) },
        ...settingsRows.map((row) => ({ section: "settings", ...row })),
        ...metricsRows.map((row) => ({ section: "metrics", ...row })),
      ];
      downloadCsv(rows, "focus-tube-backup.csv");
      return;
    }
    if (format === "excel") {
      downloadXlsx(buildBackupSheets(currentSettings, currentMetrics, exportPayload), "focus-tube-backup.xlsx");
      return;
    }
    const opened = openHumanPdf({
      title: `FocusTube - ${t(currentSettings.language, "options.data.backup_title")}`,
      settings: currentSettings,
      metrics: currentMetrics,
      language: currentSettings.language,
    });
    if (!opened) {
      showStatus(t(settings.language, "options.data.pdf_blocked"));
    }
  };

  const importData = async (file: File | null) => {
    if (!file) {
      return;
    }
    const applyPayload = async (data: unknown) => {
      if (data && typeof data === "object") {
        const wrapper = data as {
          _focustube?: { signature?: string; version?: number; type?: string };
          payload?: unknown;
        };
        if (wrapper._focustube) {
          // Validamos firma/version antes de tocar storage para rechazar archivos ajenos o viejos.
          if (wrapper._focustube.signature !== EXPORT_SIGNATURE) {
            showStatus(t(settings.language, "options.import.bad_signature"));
            return;
          }
          if (wrapper._focustube.version !== EXPORT_VERSION) {
            showStatus(t(settings.language, "options.import.version_mismatch"));
            return;
          }
          if (wrapper._focustube.type === "settings") {
            const next = normalizeSettings(wrapper.payload as Partial<Settings>);
            await saveSettings(next, t(settings.language, "options.import.success"));
            return;
          }
          if (wrapper._focustube.type === "backup") {
            const payload = wrapper.payload as { settings?: unknown; metrics?: unknown };
            if (!payload?.settings || !payload?.metrics) {
              throw new Error("Invalid backup payload");
            }
            const nextSettings = normalizeSettings(payload.settings as Partial<Settings>);
            const nextMetrics = mergeMetrics(payload.metrics as Partial<Metrics>);
            await setSettings(nextSettings);
            await setMetrics(nextMetrics);
            setLocalSettings(nextSettings);
            showStatus(t(settings.language, "options.backup.success"));
            return;
          }
          throw new Error("Unknown export type");
        }
      }

      showStatus(t(settings.language, "options.import.unsupported"));
      return;
    };

    const importCsv = async () => {
      const text = await file.text();
      const rows = parseCsv(text);
      const raw = extractRawJson(rows);
      if (!raw) {
        showStatus(t(settings.language, "options.import.unsupported"));
        return;
      }
      const data = JSON.parse(raw);
      await applyPayload(data);
    };

    const importExcel = async () => {
      const raw = await readRawJsonFromExcel(file);
      if (!raw) {
        showStatus(t(settings.language, "options.import.unsupported"));
        return;
      }
      const data = JSON.parse(raw);
      await applyPayload(data);
    };

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "pdf") {
        showStatus(t(settings.language, "options.import.pdf_only"));
        return;
      }
      if (ext === "csv") {
        await importCsv();
        return;
      }
      if (ext === "xlsx" || ext === "xls") {
        await importExcel();
        return;
      }
      const text = await file.text();
      const data = JSON.parse(text);
      await applyPayload(data);
    } catch {
      showStatus(t(settings.language, "options.import.invalid"));
    }
  };

  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";
  const dayOptions = getDayOptions(settings.language, "sunday-first");
  const exportFormatOptions = useMemo<{ value: ExportFormat; label: string }[]>(
    () => [
      { value: "json", label: t(settings.language, "options.data.format.json") },
      { value: "csv", label: t(settings.language, "options.data.format.csv") },
      { value: "excel", label: t(settings.language, "options.data.format.excel") },
      { value: "pdf", label: t(settings.language, "options.data.format.pdf") },
    ],
    [settings.language]
  );

  const guideSteps = [
    {
      id: "nav",
      target: "nav",
      title: t(settings.language, "options.guide.step.nav.title"),
      desc: t(settings.language, "options.guide.step.nav.desc"),
      highlightSelectors: ['[data-guide="nav"]'],
    },
    {
      id: "blocks",
      target: "blocks",
      title: t(settings.language, "options.guide.step.blocks.title"),
      desc: t(settings.language, "options.guide.step.blocks.desc"),
      highlightSelectors: ['[data-guide="blocks-actions"]', '[data-guide="blocks-social-grid"]'],
      scrollSelector: '[data-guide="blocks"]',
    },
    {
      id: "permanent",
      target: "permanent",
      title: t(settings.language, "options.guide.step.permanent.title"),
      desc: t(settings.language, "options.guide.step.permanent.desc"),
      highlightSelectors: ['[data-guide="weekly-session-toggle"]', '[data-guide="weekly-session-config"]'],
      scrollSelector: '[data-guide="permanent"]',
    },
    {
      id: "time",
      target: "time",
      title: t(settings.language, "options.guide.step.time.title"),
      desc: t(settings.language, "options.guide.step.time.desc"),
      highlightSelectors: ['[data-guide="time-format-toggle"]'],
    },
    {
      id: "language",
      target: "language",
      title: t(settings.language, "options.guide.step.language.title"),
      desc: t(settings.language, "options.guide.step.language.desc"),
      highlightSelectors: ['[data-guide="language-picker"]'],
    },
    {
      id: "export",
      target: "export",
      title: t(settings.language, "options.guide.step.export.title"),
      desc: t(settings.language, "options.guide.step.export.desc"),
      highlightSelectors: ['[data-guide="export-settings-card"]', '[data-guide="export-backup-card"]'],
      scrollSelector: '[data-guide="export"]',
    },
  ];
  const {
    guideActive,
    guideStepIndex,
    guideSeen,
    guideReady,
    guideStep,
    totalGuideSteps,
    startGuide,
    finishGuide,
    skipGuide,
    restartGuide,
    dismissGuide,
    goPrev,
    goNext,
    goToStep,
  } = useOnboardingGuide({ steps: guideSteps, storageKey: "onboardingSeen" });

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
      duration: formatDuration(settings.weeklyUnblockUntil - now),
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
      day: nextAllowedLabel ?? "-",
    });
  }

  return (
    <div className="options">
      <OptionsHeader
        title="FocusTube Blocker"
        subtitle={t(settings.language, "options.subtitle")}
        navItems={[
          { id: "config", label: t(settings.language, "nav.config"), href: optionsHref },
          { id: "dashboard", label: t(settings.language, "nav.dashboard"), href: dashboardHref },
          { id: "help", label: t(settings.language, "nav.help"), href: helpHref },
        ]}
        activeNavId="config"
        showGuide
        guideLabel={t(settings.language, "options.guide.show")}
        guideDisabled={!guideReady || guideActive}
        onGuideClick={startGuide}
      />

      <GuidePanel
        language={settings.language}
        guideSeen={guideSeen}
        guideActive={guideActive}
        guideReady={guideReady}
        guideStepIndex={guideStepIndex}
        totalGuideSteps={totalGuideSteps}
        guideSteps={guideSteps}
        onStartGuide={startGuide}
        onStepSelect={goToStep}
        onRestartGuide={restartGuide}
        onDismissGuide={dismissGuide}
      />

      {status ? (
        <div className="status" role="status" aria-live="polite">
          {status}
        </div>
      ) : null}

      <BlocksPanel
        settings={settings}
        language={settings.language}
        socialBlocks={socialBlocks}
        onToggleAll={(enabled) => void toggleAllBlocks(enabled)}
        onToggleSocial={(domains, enabled) => void toggleSocialBlock(domains, enabled)}
        onSaveSettings={(next) => void saveSettings(next)}
      />

      <PermanentPanel
        settings={settings}
        language={settings.language}
        dayOptions={dayOptions}
        weeklyStatusText={weeklyStatusText}
        weeklyStatusTone={weeklyStatusTone}
        canStartWeekly={canStartWeekly}
        onSaveSettings={(next) => void saveSettings(next)}
        onStartWeeklySession={startWeeklySession}
      />

      <TimePanel settings={settings} language={settings.language} onSaveSettings={(next) => void saveSettings(next)} />

      <ThemePanel language={settings.language} theme={settings.theme} onSetTheme={setTheme} />

      <LanguagePanel language={settings.language} onSetLanguage={setLanguage} />

      {SHOW_FAMILY_PANEL ? (
        <FamilyPanel
          settings={settings}
          language={settings.language}
          onToggleFamilyMode={(enabled) => void toggleFamilyMode(enabled)}
          onSelectProfile={(profileId) => void selectProfile(profileId)}
        />
      ) : null}

      <DataPanel
        language={settings.language}
        settingsExportFormat={settingsExportFormat}
        backupExportFormat={backupExportFormat}
        exportFormatOptions={exportFormatOptions}
        onChangeSettingsFormat={(value) => setSettingsExportFormat(value)}
        onChangeBackupFormat={(value) => setBackupExportFormat(value)}
        onExportData={(kind, format) => void exportData(kind, format)}
        onImportData={(file) => void importData(file)}
      />

      <GuideFloat
        language={settings.language}
        guideActive={guideActive}
        guideStep={guideStep ?? null}
        guideStepIndex={guideStepIndex}
        totalGuideSteps={totalGuideSteps}
        onPrev={goPrev}
        onNext={goNext}
        onFinish={() => void finishGuide()}
        onSkip={() => void skipGuide()}
      />

      {showScrollTop ? (
        <button
          type="button"
          className="scroll-top-btn"
          title={t(settings.language, "ui.scroll_top")}
          aria-label={t(settings.language, "ui.scroll_top")}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ^
        </button>
      ) : null}
    </div>
  );
}

function normalizeSettings(data: Partial<Settings>): Settings {
  return mergeSettings(data);
}
