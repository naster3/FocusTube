import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Chart from "chart.js/auto";
import { DEFAULT_INTERVALS, DEFAULT_SCHEDULES, DEFAULT_SETTINGS } from "../../core/defaults";
import { hashPin } from "../../core/hash";
import { t } from "../../core/i18n";
import { getMetrics, getSettings, resetMetrics, setSettings } from "../../infrastructure/storage";
import { Metrics, Settings } from "../../core/types";
import { normalizeDomain } from "../../core/url";
import { ScheduleView } from "../options/schedule/ScheduleView";
import "./dashboard.css";

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

export function Dashboard() {
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [blockedDomainInput, setBlockedDomainInput] = useState("");
  const [status, setStatus] = useState("");
  const [blockedStatus, setBlockedStatus] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinChangeNew, setPinChangeNew] = useState("");
  const [pinChangeConfirm, setPinChangeConfirm] = useState("");
  const attemptsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const attemptsChartRef = useRef<Chart | null>(null);
  const timeChartRef = useRef<Chart | null>(null);

  useEffect(() => {
    void (async () => {
      const [stored, metricsStored] = await Promise.all([getSettings(), getMetrics()]);
      setLocalSettings(stored);
      setMetrics(metricsStored);
    })();
  }, []);

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
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const showStatus = (message: string) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 2000);
  };

  const showBlockedStatus = (message: string) => {
    setBlockedStatus(message);
    setTimeout(() => setBlockedStatus(""), 2000);
  };

  const saveSettings = async (next: Settings, message?: string) => {
    setLocalSettings(next);
    await setSettings(next);
    if (message) {
      showStatus(message);
    }
  };

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

  const addWhitelist = async () => {
    const value = whitelistInput.trim();
    if (!value) {
      return;
    }
    if (!isWhitelistValid(value)) {
      showStatus(t(settings.language, "dashboard.whitelist.invalid"));
      return;
    }
    const next = Array.from(new Set([...settings.whitelist, value]));
    setWhitelistInput("");
    await saveSettings({ ...settings, whitelist: next }, t(settings.language, "dashboard.whitelist.added"));
  };

  const removeWhitelist = async (value: string) => {
    const next = settings.whitelist.filter((entry) => entry !== value);
    await saveSettings({ ...settings, whitelist: next }, t(settings.language, "dashboard.whitelist.updated"));
  };

  const enableStrictMode = async () => {
    if (!pinInput || pinInput !== pinConfirm) {
      showStatus(t(settings.language, "dashboard.strict.pin_mismatch"));
      return;
    }
    const pinHash = await hashPin(pinInput);
    await saveSettings({ ...settings, strictMode: true, pinHash }, t(settings.language, "dashboard.strict.enable"));
    setPinInput("");
    setPinConfirm("");
  };

  const disableStrictMode = async () => {
    if (!settings.pinHash) {
      return;
    }
    const pinHash = await hashPin(pinCurrent);
    if (pinHash !== settings.pinHash) {
      showStatus(t(settings.language, "dashboard.strict.pin_incorrect"));
      return;
    }
    await saveSettings({ ...settings, strictMode: false }, t(settings.language, "dashboard.strict.disable"));
    setPinCurrent("");
  };

  const changePin = async () => {
    if (!settings.pinHash) {
      return;
    }
    const currentHash = await hashPin(pinCurrent);
    if (currentHash !== settings.pinHash) {
      showStatus(t(settings.language, "dashboard.strict.pin_incorrect"));
      return;
    }
    if (!pinChangeNew || pinChangeNew !== pinChangeConfirm) {
      showStatus(t(settings.language, "dashboard.strict.pin_mismatch"));
      return;
    }
    const newHash = await hashPin(pinChangeNew);
    await saveSettings({ ...settings, pinHash: newHash }, t(settings.language, "dashboard.strict.pin_updated"));
    setPinCurrent("");
    setPinChangeNew("");
    setPinChangeConfirm("");
  };

  const getDomainOrigins = (domain: string) => [`*://${domain}/*`, `*://*.${domain}/*`];

  const requestDomainPermission = (domain: string) =>
    new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: getDomainOrigins(domain) }, (granted) => {
        resolve(Boolean(granted));
      });
    });

  const removeDomainPermission = (domain: string) =>
    new Promise<void>((resolve) => {
      chrome.permissions.remove({ origins: getDomainOrigins(domain) }, () => resolve());
    });

  const addBlockedDomain = async () => {
    const domain = normalizeDomain(blockedDomainInput);
    if (!domain) {
      showBlockedStatus(t(settings.language, "dashboard.domain.invalid"));
      return;
    }
    if (settings.blockedDomains.includes(domain)) {
      showBlockedStatus(t(settings.language, "dashboard.domain.exists"));
      return;
    }
    const granted = await requestDomainPermission(domain);
    if (!granted) {
      showBlockedStatus(t(settings.language, "dashboard.domain.permission_denied"));
      return;
    }
    const next = Array.from(new Set([...settings.blockedDomains, domain]));
    setBlockedDomainInput("");
    await saveSettings({ ...settings, blockedDomains: next });
    showBlockedStatus(t(settings.language, "dashboard.domain.added"));
  };

  const removeBlockedDomain = async (domain: string) => {
    const next = settings.blockedDomains.filter((entry) => entry !== domain);
    await saveSettings({ ...settings, blockedDomains: next }, t(settings.language, "dashboard.domain.removed"));
    void removeDomainPermission(domain);
  };

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
    showStatus(t(settings.language, "dashboard.metrics.reset"));
  };

  const chartSeries = useMemo(() => {
    if (!metrics) return null;
    const days = getRecentDays(14).reverse();
    return {
      labels: days,
      attempts: days.map((day) => metrics.attemptsByDay[day] || 0),
      times: days.map((day) => metrics.timeByDay[day] || 0)
    };
  }, [metrics]);

  useEffect(() => {
    if (!chartSeries) return;

    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {}
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
              backgroundColor: "#111827"
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
              backgroundColor: "#0f172a"
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

    return () => {
      attemptsChartRef.current?.destroy();
      attemptsChartRef.current = null;
      timeChartRef.current?.destroy();
      timeChartRef.current = null;
    };
  }, [chartSeries]);

  const isDev = window.location.pathname.includes("/src/ui/");
  const optionsHref = isDev ? "/src/ui/options/index.html" : "options.html";
  const helpHref = isDev ? "/src/ui/help/index.html" : "help.html";
  const dashboardHref = isDev ? "/src/ui/dashboard/index.html" : "dashboard.html";

  return (
    <div className="options">
      <header className="options-header">
        <h1>FocusTube Blocker</h1>
        <p>{t(settings.language, "dashboard.subtitle")}</p>
        <nav className="options-nav">
          <a href={optionsHref}>{t(settings.language, "nav.config")}</a>
          <a href={dashboardHref}>{t(settings.language, "nav.dashboard")}</a>
          <a href={helpHref}>{t(settings.language, "nav.help")}</a>
        </nav>
      </header>

      {status ? <div className="status">{status}</div> : null}

      <ScheduleView
        intervalsByDay={settings.intervalsByDay}
        timeFormat12h={settings.timeFormat12h}
        language={settings.language}
        onChange={(next) => saveSettings({ ...settings, intervalsByDay: next })}
        onReset={resetSchedules}
      />

      <section className="panel">
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
        <ul className="list">
          {settings.whitelist.length === 0 ? <li>{t(settings.language, "dashboard.empty")}</li> : null}
          {settings.whitelist.map((entry) => (
            <li key={entry}>
              <span>{entry}</span>
              <button onClick={() => removeWhitelist(entry)}>{t(settings.language, "dashboard.action.remove")}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "dashboard.blocked.title")}</h3>
        <div className="row">
          <input
            type="text"
            placeholder={t(settings.language, "dashboard.blocked.placeholder")}
            value={blockedDomainInput}
            onChange={(event) => setBlockedDomainInput(event.target.value)}
          />
          <button onClick={addBlockedDomain}>{t(settings.language, "dashboard.action.add")}</button>
        </div>
        {blockedStatus ? <div className="status">{blockedStatus}</div> : null}
        <ul className="list">
          {settings.blockedDomains.length === 0 ? <li>{t(settings.language, "dashboard.empty")}</li> : null}
          {settings.blockedDomains.map((entry) => (
            <li key={entry}>
              <span>{entry}</span>
              <button onClick={() => removeBlockedDomain(entry)}>{t(settings.language, "dashboard.action.remove")}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>{t(settings.language, "dashboard.strict.title")}</h3>
        {!settings.strictMode ? (
          <>
            <p>{t(settings.language, "dashboard.strict.desc")}</p>
            <div className="grid">
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
            <button onClick={enableStrictMode}>{t(settings.language, "dashboard.strict.enable")}</button>
          </>
        ) : (
          <>
            <p>{t(settings.language, "dashboard.strict.active")}</p>
            <div className="grid">
              <input
                type="password"
                placeholder={t(settings.language, "dashboard.strict.pin_current")}
                value={pinCurrent}
                onChange={(event) => setPinCurrent(event.target.value)}
              />
            </div>
            <div className="actions">
              <button onClick={disableStrictMode}>{t(settings.language, "dashboard.strict.disable")}</button>
            </div>
            <div className="divider" />
            <div className="grid">
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
            <div className="actions">
              <button onClick={changePin}>{t(settings.language, "dashboard.strict.pin_updated")}</button>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <h3>{t(settings.language, "dashboard.metrics.title")}</h3>
        {!metrics ? (
          <p>{t(settings.language, "dashboard.metrics.loading")}</p>
        ) : (
          <div className="dashboard">
            <div className="summary">
              {(() => {
                const todayKey = getDayKey(new Date());
                const last7 = getRecentDays(7);
                const last30 = getRecentDays(30);
                const sum = (keys: string[], field: keyof Metrics) =>
                  keys.reduce((acc, key) => acc + ((metrics[field] as Record<string, number>)[key] || 0), 0);
                const attemptsToday = metrics.attemptsByDay[todayKey] || 0;
                const timeToday = metrics.timeByDay[todayKey] || 0;
                const sessionsToday = metrics.sessionsByDay[todayKey] || 0;
                return (
                  <>
                    <div className="summary-card">
                      <h4>{t(settings.language, "dashboard.metrics.today")}</h4>
                      <div>
                        {t(settings.language, "dashboard.metrics.attempts")}: {attemptsToday}
                      </div>
                      <div>
                        {t(settings.language, "dashboard.metrics.time")}: {formatSeconds(timeToday)}
                      </div>
                      <div>
                        {t(settings.language, "dashboard.metrics.sessions")}: {sessionsToday}
                      </div>
                    </div>
                    <div className="summary-card">
                      <h4>{t(settings.language, "dashboard.metrics.last7")}</h4>
                      <div>
                        {t(settings.language, "dashboard.metrics.attempts")}: {sum(last7, "attemptsByDay")}
                      </div>
                      <div>
                        {t(settings.language, "dashboard.metrics.time")}: {formatSeconds(sum(last7, "timeByDay"))}
                      </div>
                    </div>
                    <div className="summary-card">
                      <h4>{t(settings.language, "dashboard.metrics.last30")}</h4>
                      <div>
                        {t(settings.language, "dashboard.metrics.attempts")}: {sum(last30, "attemptsByDay")}
                      </div>
                      <div>
                        {t(settings.language, "dashboard.metrics.time")}: {formatSeconds(sum(last30, "timeByDay"))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="charts">
              <div className="chart">
                <h4>{t(settings.language, "dashboard.metrics.attempts_day")}</h4>
                <div className="chart-canvas">
                  <canvas ref={attemptsCanvasRef} />
                </div>
              </div>
              <div className="chart">
                <h4>{t(settings.language, "dashboard.metrics.time_day")}</h4>
                <div className="chart-canvas">
                  <canvas ref={timeCanvasRef} />
                </div>
              </div>
            </div>

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

            <div className="actions">
              <button onClick={exportMetrics}>{t(settings.language, "dashboard.metrics.export")}</button>
              <button onClick={handleResetMetrics}>{t(settings.language, "dashboard.metrics.reset")}</button>
            </div>
          </div>
        )}
      </section>
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
