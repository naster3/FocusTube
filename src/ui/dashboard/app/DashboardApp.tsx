import React, { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_INTERVALS, DEFAULT_SCHEDULES, DEFAULT_SETTINGS } from "../../../domain/settings/defaults";
import { hashPin, verifyPin } from "../../../shared/hash";
import { t } from "../../../shared/i18n";
import {
  getMetrics,
  getSettings,
  onStorageChanged,
  resetMetrics,
  setMetrics as persistMetrics,
  setSettings,
} from "../../../infrastructure/storage";
import { DomainTag, Metrics, Settings } from "../../../domain/settings/types";
import { normalizeDomain, normalizeWhitelistEntry } from "../../../domain/blocking/url";
import { ScheduleView } from "../../options/schedule/ScheduleView";
import { DOMAIN_TAGS } from "../../../domain/blocking/tags";
import { OptionsHeader } from "../../shared/OptionsHeader";
import { useCountUp } from "../hooks/useCountUp";
import { useDomainPermissions } from "../hooks/useDomainPermissions";
import { useMetricsCharts } from "../hooks/useMetricsCharts";
import { useThemeSync } from "../../shared/hooks/useThemeSync";
import { useOnboardingGuide } from "../../shared/hooks/useOnboardingGuide";
import { formatDate, formatDateRange } from "../../../shared/i18n/dates";
import {
  deltaClass,
  formatSeconds,
  getDayKey,
  getRecentDays,
  percentDelta,
  sumMetricRange,
} from "../../../domain/metrics/utils";
import { GuidePanel } from "../components/GuidePanel";
import { GuideFloat } from "../components/GuideFloat";
import { WhitelistPanel } from "../components/WhitelistPanel";
import { BlockedPanel } from "../components/BlockedPanel";
import { StrictPanel } from "../components/StrictPanel";
import { MetricsPanel } from "../components/MetricsPanel";
import type { AdvancedData, ChartSeries, MetricsTableRow, PieSeries, SummaryData } from "../types";
import { ConfirmModal } from "../../shared/components/ConfirmModal";
import "../styles/dashboard.css";

type ToastTone = "success" | "error" | "info";
type Toast = { id: string; message: string; tone: ToastTone };
const LIST_PAGE_SIZE = 5;
const SUMMARY_ANIM_MS = 700;

export function Dashboard() {
  // Estado
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [blockedDomainInput, setBlockedDomainInput] = useState("");
  const [blockedTagInput, setBlockedTagInput] = useState<DomainTag[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinChangeNew, setPinChangeNew] = useState("");
  const [pinChangeConfirm, setPinChangeConfirm] = useState("");
  const attemptsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const toastIdRef = useRef(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [metricsTab, setMetricsTab] = useState<"summary" | "charts" | "table" | "advanced">("summary");
  const [whitelistPage, setWhitelistPage] = useState(1);
  const [blockedPage, setBlockedPage] = useState(1);
  const [summaryEl, setSummaryEl] = useState<HTMLDivElement | null>(null);
  const [summaryInView, setSummaryInView] = useState(false);
  const [summaryAnimKey, setSummaryAnimKey] = useState(0);
  const [metricsPanelReady, setMetricsPanelReady] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [undoMetrics, setUndoMetrics] = useState<Metrics | null>(null);
  const undoResetTimerRef = useRef<number | null>(null);
  const metricsPanelAnchorRef = useRef<HTMLDivElement | null>(null);

  // Etiquetas para dominios bloqueados
  const tagLabels = useMemo(
    () => ({
      intervalos: t(settings.language, "tag.intervalos"),
      por_semana: t(settings.language, "tag.por_semana"),
    }),
    [settings.language]
  );

  const tagOptions = useMemo(() => DOMAIN_TAGS.map((tag) => ({ value: tag, label: tagLabels[tag] })), [tagLabels]);

  // Carga inicial de settings y metrics.
  useEffect(() => {
    void (async () => {
      const [stored, metricsStored] = await Promise.all([getSettings(), getMetrics()]);
      setLocalSettings(stored);
      setMetrics(metricsStored);
    })();
  }, []);

  useThemeSync(settings.theme);

  // Sincroniza settings/metrics desde storage.
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
      if (changes.metrics) {
        void (async () => {
          const storedMetrics = await getMetrics();
          setMetrics(storedMetrics);
        })();
      }
    };
    return onStorageChanged(listener);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!summaryEl) {
      return () => undefined;
    }
    if (typeof IntersectionObserver === "undefined") {
      setSummaryInView(true);
      return () => undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setSummaryInView(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.35 }
    );
    observer.observe(summaryEl);
    return () => observer.disconnect();
  }, [summaryEl]);

  useEffect(() => {
    return () => {
      if (undoResetTimerRef.current) {
        window.clearTimeout(undoResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (metricsPanelReady) {
      return () => undefined;
    }

    // Diferimos charts/tablas pesadas hasta que el panel se acerque al viewport o pase un warmup corto.
    const warmupTimer = window.setTimeout(() => setMetricsPanelReady(true), 1800);

    if (!metricsPanelAnchorRef.current || typeof IntersectionObserver === "undefined") {
      return () => {
        window.clearTimeout(warmupTimer);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) {
          return;
        }
        setMetricsPanelReady(true);
        observer.disconnect();
      },
      { threshold: 0.01, rootMargin: "320px 0px" }
    );
    observer.observe(metricsPanelAnchorRef.current);

    return () => {
      window.clearTimeout(warmupTimer);
      observer.disconnect();
    };
  }, [metricsPanelReady]);

  // Helpers de mensajes UI.
  const pushToast = (message: string, tone: ToastTone = "info") => {
    if (!message) {
      return;
    }
    const id = `${Date.now()}-${toastIdRef.current++}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const showStatus = (message: string, tone: ToastTone = "info") => pushToast(message, tone);
  const showBlockedStatus = (message: string, tone: ToastTone = "info") => pushToast(message, tone);

  const guideSteps = [
    {
      id: "nav",
      target: "nav",
      title: t(settings.language, "dashboard.guide.step.nav.title"),
      desc: t(settings.language, "dashboard.guide.step.nav.desc"),
      highlightSelectors: ['[data-guide="nav"]'],
    },
    {
      id: "schedule",
      target: "schedule",
      title: t(settings.language, "dashboard.guide.step.schedule.title"),
      desc: t(settings.language, "dashboard.guide.step.schedule.desc"),
      highlightSelectors: ['[data-guide="schedule"]'],
    },
    {
      id: "whitelist",
      target: "whitelist",
      title: t(settings.language, "dashboard.guide.step.whitelist.title"),
      desc: t(settings.language, "dashboard.guide.step.whitelist.desc"),
      highlightSelectors: ['[data-guide="whitelist-controls"]', '[data-guide="whitelist-input-row"]'],
      scrollSelector: '[data-guide="whitelist"]',
    },
    {
      id: "blocked",
      target: "blocked",
      title: t(settings.language, "dashboard.guide.step.blocked.title"),
      desc: t(settings.language, "dashboard.guide.step.blocked.desc"),
      highlightSelectors: ['[data-guide="blocked-input-row"]', '[data-guide="blocked-tag-picker"]'],
      scrollSelector: '[data-guide="blocked"]',
    },
    {
      id: "metrics",
      target: "metrics",
      title: t(settings.language, "dashboard.guide.step.metrics.title"),
      desc: t(settings.language, "dashboard.guide.step.metrics.desc"),
      highlightSelectors: ['[data-guide="metrics-tabs"]', '[data-guide="metrics-actions"]'],
      scrollSelector: '[data-guide="metrics"]',
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
  } = useOnboardingGuide({ steps: guideSteps, storageKey: "dashboardOnboardingSeen" });

  // Persistencia de settings.
  const saveSettings = async (next: Settings, message?: string, tone: ToastTone = "success") => {
    setLocalSettings(next);
    await setSettings(next);
    if (message) {
      showStatus(message, tone);
    }
  };

  // Acciones de horarios.
  const resetSchedules = async () => {
    if (!window.confirm("Restablecer horarios por defecto?")) {
      return;
    }
    await saveSettings(
      {
        ...settings,
        schedules: DEFAULT_SCHEDULES,
        intervalsByDay: DEFAULT_INTERVALS,
      },
      t(settings.language, "dashboard.schedule.reset_done")
    );
  };

  // Acciones de whitelist.
  const addWhitelist = async () => {
    const value = whitelistInput.trim();
    if (!value) {
      return;
    }
    const normalized = normalizeWhitelistEntry(value);
    if (!isWhitelistValid(value) || !normalized) {
      showStatus(t(settings.language, "dashboard.whitelist.invalid"), "error");
      return;
    }
    const next = Array.from(new Set([...settings.whitelist, normalized]));
    setWhitelistInput("");
    await saveSettings({ ...settings, whitelist: next }, t(settings.language, "dashboard.whitelist.added"), "success");
  };

  const removeWhitelist = async (value: string) => {
    const next = settings.whitelist.filter((entry) => entry !== value);
    await saveSettings(
      { ...settings, whitelist: next },
      t(settings.language, "dashboard.whitelist.updated"),
      "success"
    );
  };

  // Acciones de modo estricto.
  const enableStrictMode = async () => {
    if (!pinInput || pinInput !== pinConfirm) {
      showStatus(t(settings.language, "dashboard.strict.pin_mismatch"), "error");
      return;
    }
    const pinHash = await hashPin(pinInput);
    await saveSettings(
      { ...settings, strictMode: true, pinHash },
      t(settings.language, "dashboard.strict.enable"),
      "success"
    );
    setPinInput("");
    setPinConfirm("");
  };

  const disableStrictMode = async () => {
    if (!settings.pinHash) {
      return;
    }
    const verification = await verifyPin(pinCurrent, settings.pinHash);
    if (!verification.ok) {
      showStatus(t(settings.language, "dashboard.strict.pin_incorrect"), "error");
      return;
    }
    const nextPinHash = verification.needsUpgrade ? await hashPin(pinCurrent) : settings.pinHash;
    await saveSettings(
      { ...settings, strictMode: false, pinHash: nextPinHash },
      t(settings.language, "dashboard.strict.disable"),
      "success"
    );
    setPinCurrent("");
  };

  const changePin = async () => {
    if (!settings.pinHash) {
      return;
    }
    const verification = await verifyPin(pinCurrent, settings.pinHash);
    if (!verification.ok) {
      showStatus(t(settings.language, "dashboard.strict.pin_incorrect"), "error");
      return;
    }
    if (!pinChangeNew || pinChangeNew !== pinChangeConfirm) {
      showStatus(t(settings.language, "dashboard.strict.pin_mismatch"), "error");
      return;
    }
    const newHash = await hashPin(pinChangeNew);
    await saveSettings(
      { ...settings, pinHash: newHash },
      t(settings.language, "dashboard.strict.pin_updated"),
      "success"
    );
    setPinCurrent("");
    setPinChangeNew("");
    setPinChangeConfirm("");
  };

  const {
    permissions: blockedPermissions,
    requestPermission,
    removePermission,
  } = useDomainPermissions(settings.blockedDomains);

  // Acciones de dominios bloqueados.
  const addBlockedDomain = async () => {
    const domain = normalizeDomain(blockedDomainInput);
    if (!domain) {
      showBlockedStatus(t(settings.language, "dashboard.domain.invalid"), "error");
      return;
    }
    if (blockedTagInput.length === 0) {
      showBlockedStatus(t(settings.language, "dashboard.domain.tag_required"), "error");
      return;
    }
    if (settings.blockedDomains.includes(domain)) {
      showBlockedStatus(t(settings.language, "dashboard.domain.exists"), "error");
      return;
    }
    const granted = await requestPermission(domain);
    if (!granted) {
      showBlockedStatus(t(settings.language, "dashboard.domain.permission_denied"), "error");
      return;
    }
    // El dominio queda bloqueado junto con sus tags para que la regla sobreviva a reinicios/export.
    const next = Array.from(new Set([...settings.blockedDomains, domain]));
    const nextTags = { ...settings.blockedDomainTags, [domain]: blockedTagInput };
    setBlockedDomainInput("");
    setBlockedTagInput([]);
    await saveSettings({ ...settings, blockedDomains: next, blockedDomainTags: nextTags });
    showBlockedStatus(t(settings.language, "dashboard.domain.added"), "success");
  };

  const removeBlockedDomain = async (domain: string) => {
    const next = settings.blockedDomains.filter((entry) => entry !== domain);
    const restTags = { ...settings.blockedDomainTags };
    delete restTags[domain];
    await saveSettings(
      { ...settings, blockedDomains: next, blockedDomainTags: restTags },
      t(settings.language, "dashboard.domain.removed"),
      "success"
    );
    void removePermission(domain);
  };

  const toggleDomainTag = async (domain: string, tag: DomainTag, enabled: boolean) => {
    const current = settings.blockedDomainTags[domain] ?? [];
    const nextTags = enabled ? Array.from(new Set([...current, tag])) : current.filter((entry) => entry !== tag);
    const nextMap = { ...settings.blockedDomainTags, [domain]: nextTags };
    // Los tags controlan la semantica del bloqueo sin duplicar listas de dominios.
    await saveSettings({ ...settings, blockedDomainTags: nextMap });
  };

  // Acciones de metricas.
  const exportMetrics = () => {
    if (!metrics) {
      return;
    }
    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "focus-tube-metrics.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResetMetrics = async () => {
    setResetConfirmOpen(true);
  };

  const startUndoReset = (snapshot: Metrics) => {
    if (undoResetTimerRef.current) {
      window.clearTimeout(undoResetTimerRef.current);
    }
    setUndoMetrics(snapshot);
    // Damos una ventana corta para deshacer sin persistir historial extra ni estados intermedios.
    undoResetTimerRef.current = window.setTimeout(() => {
      setUndoMetrics(null);
      undoResetTimerRef.current = null;
    }, 8000);
  };

  const confirmResetMetrics = async () => {
    setResetConfirmOpen(false);
    if (!metrics) {
      return;
    }
    const snapshot = metrics;
    await resetMetrics();
    const storedMetrics = await getMetrics();
    setMetrics(storedMetrics);
    showStatus(t(settings.language, "dashboard.metrics.reset_done"), "success");
    startUndoReset(snapshot);
  };

  const undoResetMetrics = async () => {
    if (!undoMetrics) {
      return;
    }
    if (undoResetTimerRef.current) {
      window.clearTimeout(undoResetTimerRef.current);
      undoResetTimerRef.current = null;
    }
    await persistMetrics(undoMetrics);
    setMetrics(undoMetrics);
    setUndoMetrics(null);
    showStatus(t(settings.language, "dashboard.metrics.reset_undo_done"), "success");
  };

  // Datos derivados para charts.
  const chartSeries = useMemo<ChartSeries | null>(() => {
    if (!metricsPanelReady || !metrics || metricsTab !== "charts") return null;
    const days = getRecentDays(14).reverse();
    return {
      labels: days,
      attempts: days.map((day) => metrics.attemptsByDay[day] || 0),
      times: days.map((day) => metrics.timeByDay[day] || 0),
    };
  }, [metricsPanelReady, metrics, metricsTab]);

  const chartHasData = useMemo(() => {
    if (!chartSeries) {
      return false;
    }
    return chartSeries.attempts.some((value) => value > 0) || chartSeries.times.some((value) => value > 0);
  }, [chartSeries]);

  const pieSeries = useMemo<PieSeries | null>(() => {
    if (!metricsPanelReady || !metrics || metricsTab !== "charts" || !chartHasData) return null;
    const days = getRecentDays(7);
    const totals: Record<string, number> = {};
    days.forEach((day) => {
      const byDomain = metrics.timeByDomainByDay[day] || {};
      Object.entries(byDomain).forEach(([domain, value]) => {
        totals[domain] = (totals[domain] || 0) + value;
      });
    });
    const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return { labels: [], values: [] as number[] };
    }
    // Agrupamos el resto en "other" para que la grafica siga legible con muchos dominios.
    const top = entries.slice(0, 5);
    const otherSum = entries.slice(5).reduce((acc, [, value]) => acc + value, 0);
    const labels = top.map(([domain]) => domain);
    const values = top.map(([, value]) => value);
    if (otherSum > 0) {
      labels.push(t(settings.language, "dashboard.metrics.pie.other"));
      values.push(otherSum);
    }
    return { labels, values };
  }, [metricsPanelReady, metrics, metricsTab, chartHasData, settings.language]);

  const whitelistTotal = settings.whitelist.length;
  const whitelistTotalPages = Math.max(1, Math.ceil(whitelistTotal / LIST_PAGE_SIZE));
  const whitelistPageSafe = Math.min(whitelistPage, whitelistTotalPages);
  const whitelistStart = (whitelistPageSafe - 1) * LIST_PAGE_SIZE;
  const whitelistEnd = Math.min(whitelistStart + LIST_PAGE_SIZE, whitelistTotal);
  const whitelistSlice = settings.whitelist.slice(whitelistStart, whitelistEnd);

  const blockedTotal = settings.blockedDomains.length;
  const blockedTotalPages = Math.max(1, Math.ceil(blockedTotal / LIST_PAGE_SIZE));
  const blockedPageSafe = Math.min(blockedPage, blockedTotalPages);
  const blockedStart = (blockedPageSafe - 1) * LIST_PAGE_SIZE;
  const blockedEnd = Math.min(blockedStart + LIST_PAGE_SIZE, blockedTotal);
  const blockedSlice = settings.blockedDomains.slice(blockedStart, blockedEnd);

  const summaryData = useMemo<SummaryData | null>(() => {
    if (!metricsPanelReady || !metrics || metricsTab !== "summary") {
      return null;
    }
    const todayKey = getDayKey(new Date());
    const last7 = getRecentDays(7);
    const prev7 = getRecentDays(14).slice(7);
    const last30 = getRecentDays(30);
    const attemptsToday = metrics.attemptsByDay[todayKey] || 0;
    const timeToday = metrics.timeByDay[todayKey] || 0;
    const sessionsToday = metrics.sessionsByDay[todayKey] || 0;
    const attemptsWeek = sumMetricRange(metrics, last7, "attemptsByDay");
    const attemptsPrev = sumMetricRange(metrics, prev7, "attemptsByDay");
    const timeWeek = sumMetricRange(metrics, last7, "timeByDay");
    const timePrev = sumMetricRange(metrics, prev7, "timeByDay");
    const sessionsWeek = sumMetricRange(metrics, last7, "sessionsByDay");
    const sessionsPrev = sumMetricRange(metrics, prev7, "sessionsByDay");
    const last30Attempts = sumMetricRange(metrics, last30, "attemptsByDay");
    const last30Time = sumMetricRange(metrics, last30, "timeByDay");
    const nowDate = new Date();
    const todayLabel = formatDate(settings.language, nowDate.getTime());
    const weekStart = new Date(nowDate);
    weekStart.setDate(nowDate.getDate() - 6);
    const monthStart = new Date(nowDate);
    monthStart.setDate(nowDate.getDate() - 29);
    const weekLabel = formatDateRange(settings.language, weekStart, nowDate);
    const monthLabel = formatDateRange(settings.language, monthStart, nowDate);

    return {
      attemptsToday,
      timeToday,
      sessionsToday,
      attemptsWeek,
      attemptsPrev,
      timeWeek,
      timePrev,
      sessionsWeek,
      sessionsPrev,
      last30Attempts,
      last30Time,
      todayLabel,
      weekLabel,
      monthLabel,
    };
  }, [metricsPanelReady, metrics, metricsTab, settings.language]);

  const advancedData = useMemo<AdvancedData | null>(() => {
    if (!metricsPanelReady || !metrics || metricsTab !== "advanced") {
      return null;
    }
    const last30 = getRecentDays(30);
    const prev30 = getRecentDays(60).slice(30);
    const attempts30 = sumMetricRange(metrics, last30, "attemptsByDay");
    const attemptsPrev30 = sumMetricRange(metrics, prev30, "attemptsByDay");
    const time30 = sumMetricRange(metrics, last30, "timeByDay");
    const timePrev30 = sumMetricRange(metrics, prev30, "timeByDay");
    const sessions30 = sumMetricRange(metrics, last30, "sessionsByDay");
    const sessionsPrev30 = sumMetricRange(metrics, prev30, "sessionsByDay");

    const domainTotals: Record<string, number> = {};
    for (const day of last30) {
      const domains = metrics.timeByDomainByDay[day] || {};
      for (const [domain, value] of Object.entries(domains)) {
        domainTotals[domain] = (domainTotals[domain] || 0) + value;
      }
    }
    const topDomains = Object.entries(domainTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return {
      attempts30,
      attemptsPrev30,
      time30,
      timePrev30,
      sessions30,
      sessionsPrev30,
      topDomains,
    };
  }, [metricsPanelReady, metrics, metricsTab]);

  const animateSummary = metricsPanelReady && metricsTab === "summary" && Boolean(summaryData) && summaryInView;

  useEffect(() => {
    if (animateSummary) {
      setSummaryAnimKey((prev) => prev + 1);
    }
  }, [animateSummary]);

  const attemptsTodayAnim = useCountUp(
    summaryData?.attemptsToday ?? 0,
    SUMMARY_ANIM_MS,
    animateSummary,
    summaryAnimKey
  );
  const timeTodayAnim = useCountUp(summaryData?.timeToday ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const sessionsTodayAnim = useCountUp(
    summaryData?.sessionsToday ?? 0,
    SUMMARY_ANIM_MS,
    animateSummary,
    summaryAnimKey
  );
  const attemptsWeekAnim = useCountUp(summaryData?.attemptsWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const timeWeekAnim = useCountUp(summaryData?.timeWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const sessionsWeekAnim = useCountUp(summaryData?.sessionsWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const last30AttemptsAnim = useCountUp(
    summaryData?.last30Attempts ?? 0,
    SUMMARY_ANIM_MS,
    animateSummary,
    summaryAnimKey
  );
  const last30TimeAnim = useCountUp(summaryData?.last30Time ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);

  const tableDays = useMemo(() => getRecentDays(14), []);

  const tableRows = useMemo<MetricsTableRow[]>(() => {
    if (!metricsPanelReady || !metrics || metricsTab !== "table") {
      return [];
    }
    return tableDays.map((day) => {
      const domains = metrics.timeByDomainByDay[day] || {};
      let topDomain = "";
      let topSeconds = 0;
      // Resumimos el dominio dominante del dia en lugar de listar toda la distribucion.
      for (const [domain, seconds] of Object.entries(domains)) {
        if (seconds > topSeconds) {
          topSeconds = seconds;
          topDomain = domain;
        }
      }
      const topDomainLabel = topDomain ? `${topDomain} (${formatSeconds(topSeconds)})` : "-";
      return {
        day,
        attempts: metrics.attemptsByDay[day] || 0,
        time: metrics.timeByDay[day] || 0,
        sessions: metrics.sessionsByDay[day] || 0,
        topDomainLabel,
      };
    });
  }, [metricsPanelReady, metrics, metricsTab, tableDays]);

  useEffect(() => {
    if (whitelistPage > whitelistTotalPages) {
      setWhitelistPage(whitelistTotalPages);
    }
  }, [whitelistPage, whitelistTotalPages]);

  useEffect(() => {
    if (blockedPage > blockedTotalPages) {
      setBlockedPage(blockedTotalPages);
    }
  }, [blockedPage, blockedTotalPages]);

  useMetricsCharts({
    chartSeries,
    pieSeries,
    enabled: metricsPanelReady && chartHasData,
    metricsTab,
    attemptsCanvasRef,
    timeCanvasRef,
    pieCanvasRef,
    formatSeconds,
  });

  // Links de navegacion.
  const isDevPath = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDevPath ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDevPath ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDevPath ? "/src/ui/dashboard/index.html" : "dashboard.html";

  // Render UI.
  return (
    <div className="options">
      <OptionsHeader
        title="FocusTube Blocker"
        subtitle={t(settings.language, "dashboard.subtitle")}
        navItems={[
          { id: "config", label: t(settings.language, "nav.config"), href: optionsHref },
          { id: "dashboard", label: t(settings.language, "nav.dashboard"), href: dashboardHref },
          { id: "help", label: t(settings.language, "nav.help"), href: helpHref },
        ]}
        activeNavId="dashboard"
        showGuide
        guideLabel={t(settings.language, "dashboard.guide.show")}
        guideDisabled={!guideReady || guideActive}
        onGuideClick={startGuide}
      />

      {toasts.length > 0 ? (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}

      {undoMetrics ? (
        <div className="undo-banner" role="status" aria-live="polite">
          <span>{t(settings.language, "dashboard.metrics.reset_undo")}</span>
          <button type="button" className="undo-btn" onClick={() => void undoResetMetrics()}>
            {t(settings.language, "dashboard.metrics.reset_undo_action")}
          </button>
        </div>
      ) : null}

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

      <div data-guide="schedule">
        <ScheduleView
          intervalsByDay={settings.intervalsByDay}
          timeFormat12h={settings.timeFormat12h}
          language={settings.language}
          onChange={(next) => saveSettings({ ...settings, intervalsByDay: next })}
          onReset={resetSchedules}
        />
      </div>

      <WhitelistPanel
        language={settings.language}
        whitelistEnabled={settings.whitelistEnabled}
        whitelistInput={whitelistInput}
        whitelist={settings.whitelist}
        whitelistSlice={whitelistSlice}
        whitelistTotal={whitelistTotal}
        whitelistStart={whitelistStart}
        whitelistEnd={whitelistEnd}
        whitelistPageSafe={whitelistPageSafe}
        whitelistTotalPages={whitelistTotalPages}
        onToggleEnabled={(enabled) => saveSettings({ ...settings, whitelistEnabled: enabled })}
        onInputChange={setWhitelistInput}
        onAdd={addWhitelist}
        onRemove={removeWhitelist}
        onPrevPage={() => setWhitelistPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setWhitelistPage((prev) => Math.min(whitelistTotalPages, prev + 1))}
      />

      <BlockedPanel
        language={settings.language}
        blockedDomainInput={blockedDomainInput}
        blockedDomains={settings.blockedDomains}
        blockedSlice={blockedSlice}
        blockedPermissions={blockedPermissions}
        blockedDomainTags={settings.blockedDomainTags}
        blockedTagInput={blockedTagInput}
        tagOptions={tagOptions}
        blockedTotal={blockedTotal}
        blockedStart={blockedStart}
        blockedEnd={blockedEnd}
        blockedPageSafe={blockedPageSafe}
        blockedTotalPages={blockedTotalPages}
        onDomainInputChange={setBlockedDomainInput}
        onAdd={addBlockedDomain}
        onRemove={removeBlockedDomain}
        onToggleTagInput={(tag) => {
          const set = new Set(blockedTagInput);
          if (set.has(tag)) {
            set.delete(tag);
          } else {
            set.add(tag);
          }
          setBlockedTagInput(Array.from(set));
        }}
        onToggleDomainTag={toggleDomainTag}
        onPrevPage={() => setBlockedPage((prev) => Math.max(1, prev - 1))}
        onNextPage={() => setBlockedPage((prev) => Math.min(blockedTotalPages, prev + 1))}
      />

      <StrictPanel
        language={settings.language}
        strictMode={settings.strictMode}
        pinInput={pinInput}
        pinConfirm={pinConfirm}
        pinCurrent={pinCurrent}
        pinChangeNew={pinChangeNew}
        pinChangeConfirm={pinChangeConfirm}
        onPinInputChange={setPinInput}
        onPinConfirmChange={setPinConfirm}
        onPinCurrentChange={setPinCurrent}
        onPinChangeNewChange={setPinChangeNew}
        onPinChangeConfirmChange={setPinChangeConfirm}
        onEnableStrict={enableStrictMode}
        onDisableStrict={disableStrictMode}
        onChangePin={changePin}
      />

      <div ref={metricsPanelAnchorRef}>
        <MetricsPanel
          language={settings.language}
          metrics={metrics}
          metricsTab={metricsTab}
          summaryData={summaryData}
          advancedData={advancedData}
          chartSeries={chartSeries}
          pieSeries={pieSeries}
          attemptsTodayAnim={attemptsTodayAnim}
          timeTodayAnim={timeTodayAnim}
          sessionsTodayAnim={sessionsTodayAnim}
          attemptsWeekAnim={attemptsWeekAnim}
          timeWeekAnim={timeWeekAnim}
          sessionsWeekAnim={sessionsWeekAnim}
          last30AttemptsAnim={last30AttemptsAnim}
          last30TimeAnim={last30TimeAnim}
          tableRows={tableRows}
          deferred={!metricsPanelReady}
          onMetricsTabChange={(tab) => setMetricsTab(tab)}
          onExportMetrics={exportMetrics}
          onResetMetrics={handleResetMetrics}
          onSummaryRef={setSummaryEl}
          attemptsCanvasRef={attemptsCanvasRef}
          timeCanvasRef={timeCanvasRef}
          pieCanvasRef={pieCanvasRef}
          formatSeconds={formatSeconds}
          percentDelta={percentDelta}
          deltaClass={deltaClass}
        />
      </div>
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
      <ConfirmModal
        open={resetConfirmOpen}
        title={t(settings.language, "dashboard.metrics.reset_title")}
        description={t(settings.language, "dashboard.metrics.reset_desc")}
        confirmLabel={t(settings.language, "dashboard.metrics.reset_confirm_btn")}
        cancelLabel={t(settings.language, "dashboard.metrics.reset_cancel_btn")}
        onConfirm={() => void confirmResetMetrics()}
        onCancel={() => setResetConfirmOpen(false)}
        tone="danger"
      />
    </div>
  );
}

function isWhitelistValid(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.length > 1;
  }
  return trimmed.includes("youtube.com") || trimmed.includes("youtu.be");
}
