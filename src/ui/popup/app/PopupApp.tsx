import React, { useEffect, useMemo, useRef, useState } from "react";
import { getMetrics, updateSettings } from "../../../infrastructure/storage";
import { evaluateBlock, reasonLabel } from "../../../domain/blocking/url";
import { computeScheduleTimeline, formatDuration } from "../../../domain/schedule/timeline";
import { t, tf } from "../../../shared/i18n";
import { devLog } from "../../../shared/devLogger";
import { BlockerPanel } from "../components/BlockerPanel";
import { FocusTimerCard } from "../components/FocusTimerCard";
import { useActiveTabInfo } from "../hooks/useActiveTabInfo";
import { useFocusTimer } from "../hooks/useFocusTimer";
import { formatDateTimeAmPm } from "../utils/popupTime";
import { useToast } from "../hooks/useToast";
import { useSettingsSync } from "../../shared/hooks/useSettingsSync";
import { useThemeSync } from "../../shared/hooks/useThemeSync";

// Popup principal con estado y debug.
export function Popup() {
  // Estado base de UI.
  const { settings, setSettings } = useSettingsSync();
  const [attemptsToday, setAttemptsToday] = useState(0);
  const [status, setStatus] = useState("-");
  const [reason, setReason] = useState("");
  const { tabUrl, isIncognitoTab, incognitoAllowed } = useActiveTabInfo();
  const [now, setNow] = useState(() => Date.now());
  const { toast, showToast } = useToast();
  const lastStateRef = useRef<"blocked" | "free" | null>(null);
  const lang = settings.language;
  const [activeTab, setActiveTab] = useState<"blocker" | "focus">("blocker");
  const focusTimer = useFocusTimer(now);

  // Tick para el cronometro.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Carga settings/metrics iniciales.
  useEffect(() => {
    const load = async () => {
      const metrics = await getMetrics();
      const todayKey = new Date().toISOString().slice(0, 10);
      setAttemptsToday(metrics.attemptsByDay[todayKey] || 0);
    };
    void load();
  }, []);

  useThemeSync(settings.theme);

  // Recalcula el estado de bloqueo cuando cambian settings, tab o tiempo.
  useEffect(() => {
    if (tabUrl) {
      const decision = evaluateBlock(tabUrl, settings, now);
      setStatus(decision.blocked ? t(lang, "popup.status.blocked") : t(lang, "popup.status.allowed"));
      setReason(decision.blocked ? reasonLabel(decision.reason, lang) : "");
    } else {
      setStatus(t(lang, "popup.status.no_tab"));
      setReason("");
    }
  }, [tabUrl, settings, now, lang]);

  // Flag de bloqueo manual.
  const blockEnabled = settings.blockEnabled;

  // Toggle de bloqueo manual.
  const handleToggle = async () => {
    const next = !blockEnabled;
    setSettings((prev) => (prev ? { ...prev, blockEnabled: next } : prev));
    await updateSettings({ blockEnabled: next });
  };

  // Labels derivados.
  // Etiqueta de estado principal.
  const statusLabel = useMemo(() => {
    if (reason) return `${status} (${reason})`;
    return status;
  }, [status, reason]);

  // Timeline y contadores.
  // Timeline para horarios y contadores.
  const timeline = useMemo(() => {
    return computeScheduleTimeline(settings, now);
  }, [settings, now]);

  // Etiqueta de estado por horario.
  const scheduleLabel = useMemo(() => {
    if (!timeline) return "-";
    if (timeline.state === "blocked") {
      if (timeline.reason === "manual") return t(lang, "popup.schedule.manual");
      return t(lang, "popup.schedule.schedule");
    }
    if (timeline.reason === "temporary_unblock") return t(lang, "popup.schedule.temp_unblock");
    if (timeline.reason === "weekly_unblock") return t(lang, "popup.schedule.weekly_unblock");
    return t(lang, "popup.schedule.free");
  }, [timeline, lang]);

  // Cuenta regresiva del estado actual.
  const scheduleCountdown = useMemo(() => {
    if (!timeline) return null;
    if (!timeline.currentUntil) return "--:--";
    return formatDuration(timeline.currentUntil - now);
  }, [timeline, now]);

  const scheduleCountdownText = scheduleCountdown ?? "-";

  useEffect(() => {
    if (!timeline) return;
    if (!lastStateRef.current) {
      lastStateRef.current = timeline.state;
      return;
    }
    if (lastStateRef.current === timeline.state) {
      return;
    }
    lastStateRef.current = timeline.state;
    const remainingMs = timeline.currentUntil ? Math.max(0, timeline.currentUntil - Date.now()) : null;
    const duration = remainingMs !== null ? formatDuration(remainingMs) : t(lang, "toast.duration_unknown");
    const message =
      timeline.state === "blocked"
        ? tf(lang, "toast.blocked", { duration })
        : tf(lang, "toast.free", { duration });
    showToast(message);
  }, [timeline, lang, showToast]);

  // Duracion del proximo bloque si aplica.
  const nextBlockDuration = useMemo(() => {
    if (!timeline?.nextBlockStart || !timeline?.nextBlockEnd) return null;
    return formatDuration(timeline.nextBlockEnd - timeline.nextBlockStart);
  }, [timeline]);

  // Debug: hora exacta que usa el navegador/extension.
  const browserTimeText = useMemo(() => formatDateTimeAmPm(now), [now]);
  const tzOffsetMin = useMemo(() => new Date(now).getTimezoneOffset(), [now]);
  const nextChangeText = useMemo(() => {
    if (!timeline?.nextChangeAt) return null;
    return formatDateTimeAmPm(timeline.nextChangeAt);
  }, [timeline]);

  return (
    <div className="popup">
      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
      <header>
        <h1>FocusTube</h1>
        <p>{t(lang, "popup.subtitle")}</p>
        <nav className="popup-nav" aria-label="Popup navigation">
          <button
            type="button"
            className={`popup-tab ${activeTab === "blocker" ? "active" : ""}`}
            onClick={() => setActiveTab("blocker")}
          >
            {t(lang, "popup.nav.blocker")}
          </button>
          <button
            type="button"
            className={`popup-tab ${activeTab === "focus" ? "active" : ""}`}
            onClick={() => setActiveTab("focus")}
          >
            {t(lang, "popup.nav.focus")}
          </button>
        </nav>
      </header>

      {isIncognitoTab && incognitoAllowed === false ? (
        <div className="incognito-warning">
          <div className="incognito-title">{t(lang, "popup.incognito.title")}</div>
          <div className="incognito-text">{t(lang, "popup.incognito.desc")}</div>
        </div>
      ) : null}

      {activeTab === "blocker" ? (
        <BlockerPanel
          lang={lang}
          statusLabel={statusLabel}
          attemptsToday={attemptsToday}
          scheduleLabel={scheduleLabel}
          scheduleCountdown={scheduleCountdownText}
          scheduleBlocked={timeline?.state === "blocked"}
          nextBlockDuration={nextBlockDuration}
          browserTimeText={browserTimeText}
          tzOffsetMin={tzOffsetMin}
          nextChangeText={nextChangeText}
          blockEnabled={blockEnabled}
          onToggle={handleToggle}
          onOpenOptions={() => {
            if (typeof chrome === "undefined" || !chrome.runtime?.openOptionsPage) {
              devLog("chrome.runtime.openOptionsPage not available; ignored in dev.");
              return;
            }
            chrome.runtime.openOptionsPage();
          }}
        />
      ) : (
        <FocusTimerCard
          lang={lang}
          focusMinutes={focusTimer.focusMinutes}
          breakMinutes={focusTimer.breakMinutes}
          mode={focusTimer.mode}
          running={focusTimer.running}
          remainingMs={focusTimer.remainingMs}
          onStart={focusTimer.start}
          onPause={focusTimer.pause}
          onReset={focusTimer.reset}
          onFocusMinutesChange={focusTimer.updateFocusMinutes}
          onBreakMinutesChange={focusTimer.updateBreakMinutes}
        />
      )}

    </div>
  );
}
