import React, { useEffect, useMemo, useState } from "react";
import { getMetrics, getSettings, updateSettings } from "../../shared/storage";
import { evaluateBlock, reasonLabel } from "../../shared/url";
import type { Settings } from "../../shared/types";
import { computeScheduleTimeline, formatDuration } from "../../shared/timeline";

// Helpers de formateo para debug.
function formatDateTimeAmPm(ts: number) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("es-DO");
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  return `${date} ${time}`;
}

function formatTimeAmPm(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}
// Popup principal con estado y debug.
export function Popup() {
  // Estado base de UI.
  const [settings, setSettings] = useState<Settings | null>(null);
  const [attemptsToday, setAttemptsToday] = useState(0);
  const [status, setStatus] = useState("-");
  const [reason, setReason] = useState("");
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

    // URL activa actual.
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setTabUrl(tabs[0]?.url || null);
    });
  }, []);

  // Tick para el "cronómetro" del horario.
    // Tick para el cronometro.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

    // Carga settings/metrics y evalua bloqueo.
  useEffect(() => {
    const load = async () => {
      const [s, metrics] = await Promise.all([getSettings(), getMetrics()]);
      setSettings(s);
      const todayKey = new Date().toISOString().slice(0, 10);
      setAttemptsToday(metrics.attemptsByDay[todayKey] || 0);

      if (tabUrl) {
        const decision = evaluateBlock(tabUrl, s, Date.now());
        setStatus(decision.blocked ? "Bloqueado" : "Permitido");
        setReason(decision.blocked ? reasonLabel(decision.reason) : "");
      } else {
        setStatus("Sin pestana");
      }
    };
    void load();
  }, [tabUrl]);

    // Sincroniza cambios de settings.
  useEffect(() => {
    const listener = () => {
      void (async () => {
        const s = await getSettings();
        setSettings(s);
      })();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  // Flag de bloqueo manual.
  const blockEnabled = settings?.blockEnabled ?? false;

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
    if (!settings) return null;
    return computeScheduleTimeline(settings, now);
  }, [settings, now]);

  // Etiqueta de estado por horario.
  const scheduleLabel = useMemo(() => {
    if (!timeline) return "-";
    if (timeline.state === "blocked") {
      if (timeline.reason === "manual") return "Bloqueado (manual)";
      return "Bloqueado (horario)";
    }
    if (timeline.reason === "temporary_unblock") return "Libre (desbloqueo temporal)";
    return "Libre (fuera de horario)";
  }, [timeline]);

  // Cuenta regresiva del estado actual.
  const scheduleCountdown = useMemo(() => {
    if (!timeline) return null;
    if (!timeline.currentUntil) return "∞";
    return formatDuration(timeline.currentUntil - now);
  }, [timeline, now]);

  // Duracion del proximo bloque si aplica.
  const nextBlockDuration = useMemo(() => {
    if (!timeline?.nextBlockStart || !timeline?.nextBlockEnd) return null;
    return formatDuration(timeline.nextBlockEnd - timeline.nextBlockStart);
  }, [timeline]);

  // Debug: hora exacta que está usando el navegador/extensión.
  const browserTimeText = useMemo(() => formatDateTimeAmPm(now), [now]);
  const tzOffsetMin = useMemo(() => new Date(now).getTimezoneOffset(), [now]);
  const nextChangeText = useMemo(() => {
    if (!timeline?.nextChangeAt) return null;
    return formatDateTimeAmPm(timeline.nextChangeAt);
  }, [timeline]);

  return (
    <div className="popup">
      <header>
        <h1>FocusTube</h1>
        <p>Bloqueo inteligente de YouTube</p>
      </header>

      <div className="card">
        <div className="row">
          <span>Estado pestaña</span>
          <strong>{statusLabel}</strong>
        </div>
        <div className="row">
          <span>Intentos hoy</span>
          <strong>{attemptsToday}</strong>
        </div>
      </div>

      <div className="card">
        <div className="row">
          <span>Estado por horario</span>
          <strong>{scheduleLabel}</strong>
        </div>
        <div className="row">
          <span>{timeline?.state === "blocked" ? "Falta" : "Te queda"}</span>
          <strong>{timeline ? scheduleCountdown : "-"}</strong>
        </div>
        {timeline?.state === "free" && nextBlockDuration && (
          <div className="row">
            <span>Proximo bloqueo dura</span>
            <strong>{nextBlockDuration}</strong>
          </div>
        )}
      </div>

        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>Debug tiempo</summary>
          <div className="row">
            <span>Hora del navegador</span>
            <strong style={{ fontSize: 12 }}>{browserTimeText}</strong>
          </div>
          <div className="row">
            <span>Offset TZ</span>
            <strong style={{ fontSize: 12 }}>{tzOffsetMin} min</strong>
          </div>
          <div className="row">
            <span>Próximo cambio</span>
            <strong style={{ fontSize: 12 }}>{nextChangeText ?? "-"}</strong>
          </div>
        </details>


      <div className="toggle">
        <label>
          <input type="checkbox" checked={blockEnabled} onChange={handleToggle} />
          Bloquear ahora
        </label>
      </div>

      <button
        className="primary"
        onClick={() => {
          chrome.runtime.openOptionsPage();
        }}
      >
        Abrir configuracion
      </button>
    </div>
  );
}
