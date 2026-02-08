import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Chart from "chart.js/auto";
import { DEFAULT_INTERVALS, DEFAULT_SCHEDULES, DEFAULT_SETTINGS } from "../../domain/settings/defaults";
import { hashPin, verifyPin } from "../../shared/hash";
import { t, tf } from "../../shared/i18n";
import { getMetrics, getSettings, onStorageChanged, resetMetrics, setSettings } from "../../infrastructure/storage";
import { DomainTag, Metrics, Settings } from "../../domain/settings/types";
import { normalizeDomain, normalizeWhitelistEntry } from "../../domain/blocking/url";
import { ScheduleView } from "../options/schedule/ScheduleView";
import { DOMAIN_TAGS } from "../../domain/blocking/tags";
import { devLog } from "../../shared/devLogger";
import "./dashboard.css";

// Helpers de formato y fechas.
function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getRecentDays(count: number) {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(getDayKey(d));
  }
  return days;
}

type ToastTone = "success" | "error" | "info";
type Toast = { id: string; message: string; tone: ToastTone };
const LIST_PAGE_SIZE = 5;
const SUMMARY_ANIM_MS = 700;

function useCountUp(target: number, durationMs: number, enabled: boolean, triggerKey: number, startValue = 0) {
  const [value, setValue] = useState(enabled ? target : startValue);
  const valueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setValue(target);
      valueRef.current = target;
      return () => undefined;
    }

    const from = triggerKey > 0 ? startValue : valueRef.current;
    const to = target;
    if (from === to) {
      return () => undefined;
    }

    setValue(from);
    valueRef.current = from;

    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(progress);
      const next = from + (to - from) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs, enabled, triggerKey, startValue]);

  return value;
}

export function Dashboard() {
  // Estado
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [blockedDomainInput, setBlockedDomainInput] = useState("");
  const [blockedTagInput, setBlockedTagInput] = useState<DomainTag[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [blockedPermissions, setBlockedPermissions] = useState<Record<string, boolean>>({});
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinChangeNew, setPinChangeNew] = useState("");
  const [pinChangeConfirm, setPinChangeConfirm] = useState("");
  const attemptsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const attemptsChartRef = useRef<Chart | null>(null);
  const timeChartRef = useRef<Chart | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieChartRef = useRef<Chart | null>(null);
  const toastIdRef = useRef(0);
  const [guideActive, setGuideActive] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [guideSeen, setGuideSeen] = useState(false);
  const [guideReady, setGuideReady] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [metricsTab, setMetricsTab] = useState<"summary" | "charts" | "table">("summary");
  const [whitelistPage, setWhitelistPage] = useState(1);
  const [blockedPage, setBlockedPage] = useState(1);
  const [summaryEl, setSummaryEl] = useState<HTMLDivElement | null>(null);
  const [summaryInView, setSummaryInView] = useState(false);
  const [summaryAnimKey, setSummaryAnimKey] = useState(0);

  // Etiquetas para dominios bloqueados
  const tagLabels = useMemo(
    () => ({
      intervalos: t(settings.language, "tag.intervalos"),
      por_semana: t(settings.language, "tag.por_semana")
    }),
    [settings.language]
  );

  const tagOptions = useMemo(
    () => DOMAIN_TAGS.map((tag) => ({ value: tag, label: tagLabels[tag] })),
    [tagLabels]
  );

  // Carga inicial de settings y metrics.
  useEffect(() => {
    void (async () => {
      const [stored, metricsStored] = await Promise.all([getSettings(), getMetrics()]);
      setLocalSettings(stored);
      setMetrics(metricsStored);
    })();
  }, []);

  const readGuideSeen = async () => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get("dashboardOnboardingSeen");
        return Boolean(stored.dashboardOnboardingSeen);
      }
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem("dashboardOnboardingSeen") === "1";
    } catch {
      return false;
    }
  };

  const writeGuideSeen = async (value: boolean) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ dashboardOnboardingSeen: value });
        return;
      }
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem("dashboardOnboardingSeen", value ? "1" : "0");
    } catch {
      // ignore
    }
  };

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
      desc: t(settings.language, "dashboard.guide.step.nav.desc")
    },
    {
      id: "schedule",
      target: "schedule",
      title: t(settings.language, "dashboard.guide.step.schedule.title"),
      desc: t(settings.language, "dashboard.guide.step.schedule.desc")
    },
    {
      id: "whitelist",
      target: "whitelist",
      title: t(settings.language, "dashboard.guide.step.whitelist.title"),
      desc: t(settings.language, "dashboard.guide.step.whitelist.desc")
    },
    {
      id: "blocked",
      target: "blocked",
      title: t(settings.language, "dashboard.guide.step.blocked.title"),
      desc: t(settings.language, "dashboard.guide.step.blocked.desc")
    },
    {
      id: "metrics",
      target: "metrics",
      title: t(settings.language, "dashboard.guide.step.metrics.title"),
      desc: t(settings.language, "dashboard.guide.step.metrics.desc")
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
        intervalsByDay: DEFAULT_INTERVALS
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
    await saveSettings({ ...settings, whitelist: next }, t(settings.language, "dashboard.whitelist.updated"), "success");
  };

  // Acciones de modo estricto.
  const enableStrictMode = async () => {
    if (!pinInput || pinInput !== pinConfirm) {
      showStatus(t(settings.language, "dashboard.strict.pin_mismatch"), "error");
      return;
    }
    const pinHash = await hashPin(pinInput);
    await saveSettings({ ...settings, strictMode: true, pinHash }, t(settings.language, "dashboard.strict.enable"), "success");
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
    await saveSettings({ ...settings, pinHash: newHash }, t(settings.language, "dashboard.strict.pin_updated"), "success");
    setPinCurrent("");
    setPinChangeNew("");
    setPinChangeConfirm("");
  };

  // Helpers de permisos por dominio.
  const getDomainOrigins = (domain: string) => [`*://${domain}/*`, `*://*.${domain}/*`];

  const requestDomainPermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) {
      devLog("chrome.permissions.request not available; skipping permission prompt (dev only).");
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: getDomainOrigins(domain) }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  };

  const removeDomainPermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.remove) {
      devLog("chrome.permissions.remove not available; skipping permission cleanup (dev only).");
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      chrome.permissions.remove({ origins: getDomainOrigins(domain) }, () => resolve());
    });
  };

  const readDomainPermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.contains) {
      devLog("chrome.permissions.contains not available; assuming granted (dev only).");
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      chrome.permissions.contains({ origins: getDomainOrigins(domain) }, (granted) => resolve(Boolean(granted)));
    });
  };

  // Actualiza permisos de dominios bloqueados.
  useEffect(() => {
    let cancelled = false;
    const refreshPermissions = async () => {
      if (settings.blockedDomains.length === 0) {
        setBlockedPermissions({});
        return;
      }
      const entries = await Promise.all(
        settings.blockedDomains.map(async (domain) => [domain, await readDomainPermission(domain)] as const)
      );
      if (!cancelled) {
        setBlockedPermissions(Object.fromEntries(entries));
      }
    };
    void refreshPermissions();
    return () => {
      cancelled = true;
    };
  }, [settings.blockedDomains]);

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
    const granted = await requestDomainPermission(domain);
    if (!granted) {
      showBlockedStatus(t(settings.language, "dashboard.domain.permission_denied"), "error");
      return;
    }
    const next = Array.from(new Set([...settings.blockedDomains, domain]));
    const nextTags = { ...settings.blockedDomainTags, [domain]: blockedTagInput };
    setBlockedDomainInput("");
    setBlockedTagInput([]);
    await saveSettings({ ...settings, blockedDomains: next, blockedDomainTags: nextTags });
    showBlockedStatus(t(settings.language, "dashboard.domain.added"), "success");
  };

  const removeBlockedDomain = async (domain: string) => {
    const next = settings.blockedDomains.filter((entry) => entry !== domain);
    const { [domain]: _removed, ...restTags } = settings.blockedDomainTags;
    await saveSettings(
      { ...settings, blockedDomains: next, blockedDomainTags: restTags },
      t(settings.language, "dashboard.domain.removed"),
      "success"
    );
    void removeDomainPermission(domain);
  };

  const toggleDomainTag = async (domain: string, tag: DomainTag, enabled: boolean) => {
    const current = settings.blockedDomainTags[domain] ?? [];
    const nextTags = enabled
      ? Array.from(new Set([...current, tag]))
      : current.filter((entry) => entry !== tag);
    const nextMap = { ...settings.blockedDomainTags, [domain]: nextTags };
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
    if (!window.confirm(t(settings.language, "dashboard.metrics.reset_confirm"))) {
      return;
    }
    await resetMetrics();
    const storedMetrics = await getMetrics();
    setMetrics(storedMetrics);
    showStatus(t(settings.language, "dashboard.metrics.reset"), "success");
  };

  // Datos derivados para charts.
  const chartSeries = useMemo(() => {
    if (!metrics) return null;
    const days = getRecentDays(14).reverse();
    return {
      labels: days,
      attempts: days.map((day) => metrics.attemptsByDay[day] || 0),
      times: days.map((day) => metrics.timeByDay[day] || 0)
    };
  }, [metrics]);

  const pieSeries = useMemo(() => {
    if (!metrics) return null;
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
    const top = entries.slice(0, 5);
    const otherSum = entries.slice(5).reduce((acc, [, value]) => acc + value, 0);
    const labels = top.map(([domain]) => domain);
    const values = top.map(([, value]) => value);
    if (otherSum > 0) {
      labels.push(t(settings.language, "dashboard.metrics.pie.other"));
      values.push(otherSum);
    }
    return { labels, values };
  }, [metrics, settings.language]);

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

  const summaryData = metrics
    ? (() => {
        const todayKey = getDayKey(new Date());
        const last7 = getRecentDays(7);
        const prev7 = getRecentDays(14).slice(7);
        const last30 = getRecentDays(30);
        const sum = (keys: string[], field: keyof Metrics) =>
          keys.reduce((acc, key) => acc + ((metrics[field] as Record<string, number>)[key] || 0), 0);
        const attemptsToday = metrics.attemptsByDay[todayKey] || 0;
        const timeToday = metrics.timeByDay[todayKey] || 0;
        const sessionsToday = metrics.sessionsByDay[todayKey] || 0;
        const attemptsWeek = sum(last7, "attemptsByDay");
        const attemptsPrev = sum(prev7, "attemptsByDay");
        const timeWeek = sum(last7, "timeByDay");
        const timePrev = sum(prev7, "timeByDay");
        const sessionsWeek = sum(last7, "sessionsByDay");
        const sessionsPrev = sum(prev7, "sessionsByDay");
        const last30Attempts = sum(last30, "attemptsByDay");
        const last30Time = sum(last30, "timeByDay");
        const nowDate = new Date();
        const dateFormatter = new Intl.DateTimeFormat(settings.language, { dateStyle: "medium" });
        const todayLabel = dateFormatter.format(nowDate);
        const weekStart = new Date(nowDate);
        weekStart.setDate(nowDate.getDate() - 6);
        const monthStart = new Date(nowDate);
        monthStart.setDate(nowDate.getDate() - 29);
        const weekLabel = `${dateFormatter.format(weekStart)} - ${dateFormatter.format(nowDate)}`;
        const monthLabel = `${dateFormatter.format(monthStart)} - ${dateFormatter.format(nowDate)}`;

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
          monthLabel
        };
      })()
    : null;

  const animateSummary = metricsTab === "summary" && Boolean(summaryData) && summaryInView;

  useEffect(() => {
    if (animateSummary) {
      setSummaryAnimKey((prev) => prev + 1);
    }
  }, [animateSummary]);

  const attemptsTodayAnim = useCountUp(summaryData?.attemptsToday ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const timeTodayAnim = useCountUp(summaryData?.timeToday ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const sessionsTodayAnim = useCountUp(summaryData?.sessionsToday ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const attemptsWeekAnim = useCountUp(summaryData?.attemptsWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const timeWeekAnim = useCountUp(summaryData?.timeWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const sessionsWeekAnim = useCountUp(summaryData?.sessionsWeek ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const last30AttemptsAnim = useCountUp(summaryData?.last30Attempts ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);
  const last30TimeAnim = useCountUp(summaryData?.last30Time ?? 0, SUMMARY_ANIM_MS, animateSummary, summaryAnimKey);

  const percentDelta = (current: number, previous: number) => {
    if (previous === 0) {
      return current === 0 ? "0%" : "+100%";
    }
    const delta = ((current - previous) / previous) * 100;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(0)}%`;
  };

  const deltaClass = (current: number, previous: number) => {
    if (previous === 0) {
      return current === 0 ? "neutral" : "positive";
    }
    if (current === previous) return "neutral";
    return current > previous ? "positive" : "negative";
  };

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

  // Renderiza charts cuando hay datos.
  useEffect(() => {
    if (!chartSeries || metricsTab !== "charts") {
      return;
    }

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800,
        easing: "easeOutQuart"
      },
      transitions: {
        active: {
          animation: { duration: 200 }
        },
        resize: {
          animation: { duration: 300 }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items: { label?: string }[]) => (items[0]?.label ? `Fecha: ${items[0].label}` : "")
          }
        }
      },
      scales: {
        x: { ticks: { autoSkip: true, maxTicksLimit: 7 } },
        y: { beginAtZero: true }
      }
    };

    if (attemptsCanvasRef.current) {
      attemptsChartRef.current?.destroy();
      attemptsChartRef.current = new Chart(attemptsCanvasRef.current, {
        type: "bar",
        data: {
          labels: chartSeries.labels,
          datasets: [
            {
              data: chartSeries.attempts,
              backgroundColor: "rgba(239, 68, 68, 0.35)",
              borderColor: "rgba(239, 68, 68, 0.9)",
              borderWidth: 1,
              borderRadius: 8
            }
          ]
        },
        options: {
          ...baseOptions,
          scales: {
            ...baseOptions.scales,
            y: {
              ...(baseOptions.scales?.y || {}),
              ticks: {
                precision: 0,
                stepSize: 1
              }
            }
          },
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              callbacks: {
                label: (ctx) => `Intentos: ${ctx.parsed.y ?? 0}`
              }
            }
          }
        }
      });
    }

    if (timeCanvasRef.current) {
      timeChartRef.current?.destroy();
      timeChartRef.current = new Chart(timeCanvasRef.current, {
        type: "bar",
        data: {
          labels: chartSeries.labels,
          datasets: [
            {
              data: chartSeries.times,
              backgroundColor: "rgba(59, 130, 246, 0.35)",
              borderColor: "rgba(59, 130, 246, 0.9)",
              borderWidth: 1,
              borderRadius: 8
            }
          ]
        },
        options: {
          ...baseOptions,
          plugins: {
            ...baseOptions.plugins,
            tooltip: {
              callbacks: {
                label: (ctx) => `Tiempo: ${formatSeconds(ctx.parsed.y ?? 0)}`
              }
            }
          }
        }
      });
    }

    if (pieCanvasRef.current && pieSeries) {
      pieChartRef.current?.destroy();
      pieChartRef.current = new Chart(pieCanvasRef.current, {
        type: "pie",
        data: {
          labels: pieSeries.labels,
          datasets: [
            {
              data: pieSeries.values,
              backgroundColor: [
                "rgba(59, 130, 246, 0.6)",
                "rgba(16, 185, 129, 0.6)",
                "rgba(249, 115, 22, 0.6)",
                "rgba(168, 85, 247, 0.6)",
                "rgba(234, 179, 8, 0.6)",
                "rgba(148, 163, 184, 0.6)"
              ],
              borderColor: "rgba(255, 255, 255, 0.9)",
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 900,
            easing: "easeOutQuart"
          },
          transitions: {
            active: {
              animation: { duration: 200 }
            },
            resize: {
              animation: { duration: 300 }
            }
          },
          plugins: {
            legend: { display: true, position: "bottom" }
          }
        }
      });
    }

    return () => {
      attemptsChartRef.current?.destroy();
      attemptsChartRef.current = null;
      timeChartRef.current?.destroy();
      timeChartRef.current = null;
      pieChartRef.current?.destroy();
      pieChartRef.current = null;
    };
  }, [chartSeries, pieSeries, metricsTab]);

  // Links de navegacion.
  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";

  // Render UI.
  return (
    <div className="options">
      <header className="options-header">
        <h1>FocusTube Blocker</h1>
        <p>{t(settings.language, "dashboard.subtitle")}</p>
        <nav className="options-nav" data-guide="nav">
          <a href={optionsHref}>{t(settings.language, "nav.config")}</a>
          <a href={dashboardHref}>{t(settings.language, "nav.dashboard")}</a>
          <a href={helpHref}>{t(settings.language, "nav.help")}</a>
        </nav>
        <div className="guide-trigger">
          <button type="button" className="btn-ghost" onClick={startGuide} disabled={!guideReady || guideActive}>
            {t(settings.language, "dashboard.guide.show")}
          </button>
        </div>
      </header>

      {toasts.length > 0 ? (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.tone}`}>
              {toast.message}
            </div>
          ))}
        </div>
      ) : null}

      {!guideSeen || guideActive ? (
        <section className="panel guide-panel">
          <div className="guide-header">
            <div>
              <h3>{t(settings.language, "dashboard.guide.title")}</h3>
              <p className="guide-sub">{t(settings.language, "dashboard.guide.subtitle")}</p>
            </div>
            <div className="guide-actions">
              <button onClick={startGuide} disabled={!guideReady || guideActive}>
                {t(settings.language, "dashboard.guide.start")}
              </button>
              {guideSeen ? (
                <button type="button" className="btn-ghost" onClick={restartGuide}>
                  {t(settings.language, "dashboard.guide.restart")}
                </button>
              ) : (
                <button type="button" className="btn-ghost" onClick={dismissGuide}>
                  {t(settings.language, "dashboard.guide.dismiss")}
                </button>
              )}
            </div>
          </div>
          <ol className="guide-steps">
            <li>{t(settings.language, "dashboard.guide.step1")}</li>
            <li>{t(settings.language, "dashboard.guide.step2")}</li>
            <li>{t(settings.language, "dashboard.guide.step3")}</li>
          </ol>
        </section>
      ) : null}

      <div data-guide="schedule">
        <ScheduleView
          intervalsByDay={settings.intervalsByDay}
          timeFormat12h={settings.timeFormat12h}
          language={settings.language}
          onChange={(next) => saveSettings({ ...settings, intervalsByDay: next })}
          onReset={resetSchedules}
        />
      </div>

      <section className="panel" data-guide="whitelist">
        <h3>{t(settings.language, "dashboard.whitelist.title")}</h3>
        <div className="row">
          <input
            type="text"
            placeholder={t(settings.language, "dashboard.whitelist.placeholder")}
            value={whitelistInput}
            onChange={(event) => setWhitelistInput(event.target.value)}
          />
          <button onClick={addWhitelist}>{t(settings.language, "dashboard.action.add")}</button>
        </div>
        {settings.whitelist.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">o o</div>
            <div className="empty-state-title">{t(settings.language, "dashboard.empty.whitelist.title")}</div>
            <div className="empty-state-text">{t(settings.language, "dashboard.empty.whitelist.desc")}</div>
          </div>
        ) : (
          <>
            <ul className="list whitelist-list">
            {whitelistSlice.map((entry) => (
              <li key={entry} className="whitelist-item">
                <div className="whitelist-item-main">
                  <span className="whitelist-icon">✓</span>
                  <span className="whitelist-url" title={entry}>
                    {entry}
                  </span>
                </div>
                <button className="btn-ghost btn-small" onClick={() => removeWhitelist(entry)}>
                  {t(settings.language, "dashboard.action.remove")}
                </button>
              </li>
            ))}
            </ul>
            {whitelistTotalPages > 1 ? (
              <div className="pagination">
                <span className="pagination-info">
                  {tf(settings.language, "dashboard.pagination.showing", {
                    from: whitelistStart + 1,
                    to: whitelistEnd,
                    total: whitelistTotal
                  })}
                </span>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setWhitelistPage((prev) => Math.max(1, prev - 1))}
                    disabled={whitelistPageSafe <= 1}
                  >
                    {t(settings.language, "dashboard.pagination.prev")}
                  </button>
                  <span className="pagination-page">
                    {tf(settings.language, "dashboard.pagination.page", {
                      current: whitelistPageSafe,
                      total: whitelistTotalPages
                    })}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setWhitelistPage((prev) => Math.min(whitelistTotalPages, prev + 1))}
                    disabled={whitelistPageSafe >= whitelistTotalPages}
                  >
                    {t(settings.language, "dashboard.pagination.next")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="panel" data-guide="blocked">
        <h3>{t(settings.language, "dashboard.blocked.title")}</h3>
        <div className="row blocked-input-row">
          <input
            type="text"
            placeholder={t(settings.language, "dashboard.blocked.placeholder")}
            value={blockedDomainInput}
            onChange={(event) => setBlockedDomainInput(event.target.value)}
          />
          <button onClick={addBlockedDomain}>{t(settings.language, "dashboard.action.add")}</button>
        </div>
        <div className="tag-picker">
          <span>{t(settings.language, "dashboard.domain.tags_label")}</span>
          <div className="tag-list">
            {tagOptions.map((tag) => {
              const active = blockedTagInput.includes(tag.value);
              return (
                <label key={tag.value} className={`tag-chip ${active ? "active" : "inactive"}`}>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      const set = new Set(blockedTagInput);
                      if (set.has(tag.value)) {
                        set.delete(tag.value);
                      } else {
                        set.add(tag.value);
                      }
                      setBlockedTagInput(Array.from(set));
                    }}
                  />
                  {tag.label}
                </label>
              );
            })}
          </div>
        </div>
        {settings.blockedDomains.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">o o</div>
            <div className="empty-state-title">{t(settings.language, "dashboard.empty.blocked.title")}</div>
            <div className="empty-state-text">{t(settings.language, "dashboard.empty.blocked.desc")}</div>
          </div>
        ) : (
          <>
            <ul className="list">
            {blockedSlice.map((entry) => {
              const hasPermission = blockedPermissions[entry] ?? true;
              const tags = settings.blockedDomainTags[entry] ?? [];
              return (
                <li
                  key={entry}
                  className={`blocked-card ${hasPermission ? "" : "blocked-card-missing"}`}
                >
                  <div className="blocked-card-header">
                    <div className="blocked-domain-main">
                      <span className="blocked-domain-text">{entry}</span>
                      <span
                        className={`perm-dot ${hasPermission ? "perm-ok" : "perm-missing"}`}
                        title={t(
                          settings.language,
                          hasPermission ? "dashboard.domain.permission_ok" : "dashboard.domain.permission_missing"
                        )}
                        aria-label={t(
                          settings.language,
                          hasPermission ? "dashboard.domain.permission_ok" : "dashboard.domain.permission_missing"
                        )}
                      />
                    </div>
                    <button
                      className="btn-ghost btn-small"
                      onClick={() => removeBlockedDomain(entry)}
                    >
                      {t(settings.language, "dashboard.action.remove")}
                    </button>
                  </div>
                  <div className="tag-list">
                    {tagOptions.map((tag) => {
                      const active = tags.includes(tag.value);
                      return (
                        <label
                          key={`${entry}-${tag.value}`}
                          className={`tag-chip ${active ? "active" : "inactive"}`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={(event) => toggleDomainTag(entry, tag.value, event.target.checked)}
                          />
                          {tag.label}
                        </label>
                      );
                    })}
                    {tags.length === 0 ? (
                      <span className="tag-warning">{t(settings.language, "dashboard.domain.tag_required")}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
            </ul>
            {blockedTotalPages > 1 ? (
              <div className="pagination">
                <span className="pagination-info">
                  {tf(settings.language, "dashboard.pagination.showing", {
                    from: blockedStart + 1,
                    to: blockedEnd,
                    total: blockedTotal
                  })}
                </span>
                <div className="pagination-controls">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setBlockedPage((prev) => Math.max(1, prev - 1))}
                    disabled={blockedPageSafe <= 1}
                  >
                    {t(settings.language, "dashboard.pagination.prev")}
                  </button>
                  <span className="pagination-page">
                    {tf(settings.language, "dashboard.pagination.page", {
                      current: blockedPageSafe,
                      total: blockedTotalPages
                    })}
                  </span>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => setBlockedPage((prev) => Math.min(blockedTotalPages, prev + 1))}
                    disabled={blockedPageSafe >= blockedTotalPages}
                  >
                    {t(settings.language, "dashboard.pagination.next")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="panel strict-panel">
        <div className="strict-header">
          <div>
            <h3>{t(settings.language, "dashboard.strict.title")}</h3>
            <p className="strict-sub">
              {settings.strictMode
                ? t(settings.language, "dashboard.strict.active")
                : t(settings.language, "dashboard.strict.desc")}
            </p>
          </div>
          <span className={`strict-badge ${settings.strictMode ? "on" : "off"}`}>
            {settings.strictMode ? t(settings.language, "dashboard.strict.active") : t(settings.language, "dashboard.strict.enable")}
          </span>
        </div>
        {!settings.strictMode ? (
          <>
            <div className="strict-fields">
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin")}
                value={pinInput}
                onChange={(event) => setPinInput(event.target.value)}
              />
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin_confirm")}
                value={pinConfirm}
                onChange={(event) => setPinConfirm(event.target.value)}
              />
            </div>
            <div className="strict-actions">
              <button className="strict-primary" onClick={enableStrictMode}>
                {t(settings.language, "dashboard.strict.enable")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="strict-active">
              <span className="strict-dot" />
              <span>{t(settings.language, "dashboard.strict.active")}</span>
            </div>
            <div className="strict-fields">
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin_current")}
                value={pinCurrent}
                onChange={(event) => setPinCurrent(event.target.value)}
              />
            </div>
            <div className="strict-actions">
              <button className="strict-danger" onClick={disableStrictMode}>
                {t(settings.language, "dashboard.strict.disable")}
              </button>
            </div>
            <div className="strict-divider" />
            <div className="strict-fields">
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin_new")}
                value={pinChangeNew}
                onChange={(event) => setPinChangeNew(event.target.value)}
              />
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin_new_confirm")}
                value={pinChangeConfirm}
                onChange={(event) => setPinChangeConfirm(event.target.value)}
              />
            </div>
            <div className="strict-actions">
              <button className="strict-secondary" onClick={changePin}>
                {t(settings.language, "dashboard.strict.pin_updated")}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="panel" data-guide="metrics">
        <div className="metrics-header">
          <h3>{t(settings.language, "dashboard.metrics.title")}</h3>
          <div className="metrics-nav">
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "summary" ? "active" : ""}`}
              onClick={() => setMetricsTab("summary")}
            >
              {t(settings.language, "dashboard.metrics.tab.summary")}
            </button>
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "charts" ? "active" : ""}`}
              onClick={() => setMetricsTab("charts")}
            >
              {t(settings.language, "dashboard.metrics.tab.charts")}
            </button>
            <button
              type="button"
              className={`metrics-tab ${metricsTab === "table" ? "active" : ""}`}
              onClick={() => setMetricsTab("table")}
            >
              {t(settings.language, "dashboard.metrics.tab.table")}
            </button>
          </div>
        </div>
        {!metrics ? (
          <p>{t(settings.language, "dashboard.metrics.loading")}</p>
        ) : (
          <div className="dashboard">
            {metricsTab === "summary" && summaryData ? (
              <div className="summary" ref={setSummaryEl}>
                <div className="summary-card metric-card metric-attempts">
                  <div className="summary-header">
                    <div>
                      <h4>{t(settings.language, "dashboard.metrics.today")}</h4>
                      <span className="summary-sub">{summaryData.todayLabel}</span>
                    </div>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.attempts")}</span>
                    <span className="metric-value">{Math.round(attemptsTodayAnim)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.time")}</span>
                    <span className="metric-value">{formatSeconds(Math.round(timeTodayAnim))}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.sessions")}</span>
                    <span className="metric-value">{Math.round(sessionsTodayAnim)}</span>
                  </div>
                  <div className="summary-note">{t(settings.language, "dashboard.metrics.note.today")}</div>
                </div>
                <div className="summary-card metric-card metric-time">
                  <div className="summary-header">
                    <div>
                      <h4>{t(settings.language, "dashboard.metrics.last7")}</h4>
                      <span className="summary-sub">{summaryData.weekLabel}</span>
                    </div>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.attempts")}</span>
                    <span className="metric-value">{Math.round(attemptsWeekAnim)}</span>
                    <span className={`metric-delta ${deltaClass(summaryData.attemptsWeek, summaryData.attemptsPrev)}`}>
                      {percentDelta(summaryData.attemptsWeek, summaryData.attemptsPrev)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.time")}</span>
                    <span className="metric-value">{formatSeconds(Math.round(timeWeekAnim))}</span>
                    <span className={`metric-delta ${deltaClass(summaryData.timeWeek, summaryData.timePrev)}`}>
                      {percentDelta(summaryData.timeWeek, summaryData.timePrev)}
                    </span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.sessions")}</span>
                    <span className="metric-value">{Math.round(sessionsWeekAnim)}</span>
                    <span className={`metric-delta ${deltaClass(summaryData.sessionsWeek, summaryData.sessionsPrev)}`}>
                      {percentDelta(summaryData.sessionsWeek, summaryData.sessionsPrev)}
                    </span>
                  </div>
                  <div className="summary-note">{t(settings.language, "dashboard.metrics.note.last7")}</div>
                </div>
                <div className="summary-card metric-card metric-sessions">
                  <div className="summary-header">
                    <div>
                      <h4>{t(settings.language, "dashboard.metrics.last30")}</h4>
                      <span className="summary-sub">{summaryData.monthLabel}</span>
                    </div>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.attempts")}</span>
                    <span className="metric-value">{Math.round(last30AttemptsAnim)}</span>
                  </div>
                  <div className="metric-row">
                    <span className="metric-label">{t(settings.language, "dashboard.metrics.time")}</span>
                    <span className="metric-value">{formatSeconds(Math.round(last30TimeAnim))}</span>
                  </div>
                  <div className="summary-note">{t(settings.language, "dashboard.metrics.note.last30")}</div>
                </div>
              </div>
            ) : null}

            {metricsTab === "charts" ? (
              chartSeries && (chartSeries.attempts.some((value) => value > 0) || chartSeries.times.some((value) => value > 0)) ? (
                <div className="charts">
                  <div className="chart metric-attempts">
                    <h4>{t(settings.language, "dashboard.metrics.attempts_day")}</h4>
                    <div className="chart-canvas">
                      <canvas ref={attemptsCanvasRef} />
                    </div>
                  </div>
                  <div className="chart metric-time">
                    <h4>{t(settings.language, "dashboard.metrics.time_day")}</h4>
                    <div className="chart-canvas">
                      <canvas ref={timeCanvasRef} />
                    </div>
                  </div>
                  <div className="chart metric-pie">
                    <h4>{t(settings.language, "dashboard.metrics.pie.title")}</h4>
                    {pieSeries && pieSeries.values.length > 0 ? (
                      <div className="chart-canvas pie">
                        <canvas ref={pieCanvasRef} />
                      </div>
                    ) : (
                      <div className="metrics-empty small">
                        <div className="metrics-empty-title">{t(settings.language, "dashboard.metrics.pie.empty")}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-state metrics-empty">
                  <div className="empty-state-icon">o o</div>
                  <div className="empty-state-title">{t(settings.language, "dashboard.metrics.empty.title")}</div>
                  <div className="empty-state-text">{t(settings.language, "dashboard.metrics.empty.desc")}</div>
                </div>
              )
            ) : null}

            {metricsTab === "table" ? (
              <div className="table">
                <div className="row header">
                  <span>{t(settings.language, "dashboard.metrics.table.date")}</span>
                  <span>{t(settings.language, "dashboard.metrics.attempts")}</span>
                  <span>{t(settings.language, "dashboard.metrics.time")}</span>
                  <span>{t(settings.language, "dashboard.metrics.sessions")}</span>
                  <span>{t(settings.language, "dashboard.metrics.table.top_domain")}</span>
                </div>
                {getRecentDays(14).map((day) => {
                  const domains = metrics.timeByDomainByDay[day] || {};
                  const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0];
                  return (
                    <div className="row" key={day}>
                      <span>{day}</span>
                      <span>{metrics.attemptsByDay[day] || 0}</span>
                      <span>{formatSeconds(metrics.timeByDay[day] || 0)}</span>
                      <span>{metrics.sessionsByDay[day] || 0}</span>
                      <span>{topDomain ? `${topDomain[0]} (${formatSeconds(topDomain[1])})` : "-"}</span>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="actions">
              <button onClick={exportMetrics}>{t(settings.language, "dashboard.metrics.export")}</button>
              <button onClick={handleResetMetrics}>{t(settings.language, "dashboard.metrics.reset")}</button>
            </div>
          </div>
        )}
      </section>

      {guideActive && guideStep ? (
        <div className="guide-float" role="dialog" aria-live="polite">
          <div className="guide-progress">
            {tf(settings.language, "dashboard.guide.progress", {
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
              {t(settings.language, "dashboard.guide.back")}
            </button>
            {guideStepIndex === totalGuideSteps - 1 ? (
              <button type="button" onClick={finishGuide}>
                {t(settings.language, "dashboard.guide.finish")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGuideStepIndex((prev) => Math.min(totalGuideSteps - 1, prev + 1))}
              >
                {t(settings.language, "dashboard.guide.next")}
              </button>
            )}
            <button type="button" className="btn-ghost" onClick={skipGuide}>
              {t(settings.language, "dashboard.guide.skip")}
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

function isWhitelistValid(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.length > 1;
  }
  return trimmed.includes("youtube.com") || trimmed.includes("youtu.be");
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Dashboard />
    </React.StrictMode>
  );
}
