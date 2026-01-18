import React, { useEffect, useMemo, useState } from "react";
import { DEFAULT_SETTINGS } from "../../shared/defaults";
import { hashPin } from "../../shared/hash";
import { getMetrics, getSettings, resetMetrics, setSettings } from "../../shared/storage";
import { Metrics, Settings } from "../../shared/types";
import { normalizeDomain } from "../../shared/url";
import { ScheduleView } from "./schedule/ScheduleView";

// Helpers de dashboard y formato.
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

// Genera claves de dias recientes.
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

// Pantalla principal de opciones.
export function Options() {
  // Estado base de UI.
  const [settings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinCurrent, setPinCurrent] = useState("");
  const [pinChangeNew, setPinChangeNew] = useState("");
  const [pinChangeConfirm, setPinChangeConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [blockedDomainInput, setBlockedDomainInput] = useState("");

    // Carga inicial de settings y metrics.
  useEffect(() => {
    void (async () => {
      const [stored, metricsStored] = await Promise.all([getSettings(), getMetrics()]);
      setLocalSettings(stored);
      setMetrics(metricsStored);
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

  // Horarios: manejados por ScheduleView.

  // Whitelist.
  const addWhitelist = async () => {
    const value = whitelistInput.trim();
    if (!value) {
      return;
    }
    if (!isWhitelistValid(value)) {
      setStatus("Entrada invalida");
      return;
    }
    const next = Array.from(new Set([...settings.whitelist, value]));
    setWhitelistInput("");
    await saveSettings({ ...settings, whitelist: next });
  };

  const removeWhitelist = async (value: string) => {
    const next = settings.whitelist.filter((entry) => entry !== value);
    await saveSettings({ ...settings, whitelist: next });
  };

  // Modo estricto y PIN.
  const enableStrictMode = async () => {
    if (!pinInput || pinInput !== pinConfirm) {
      setStatus("PIN no coincide");
      return;
    }
    const pinHash = await hashPin(pinInput);
    await saveSettings({ ...settings, strictMode: true, pinHash }, "Modo estricto activado");
    setPinInput("");
    setPinConfirm("");
  };

  const disableStrictMode = async () => {
    if (!settings.pinHash) {
      return;
    }
    const pinHash = await hashPin(pinCurrent);
    if (pinHash !== settings.pinHash) {
      setStatus("PIN incorrecto");
      return;
    }
    await saveSettings({ ...settings, strictMode: false }, "Modo estricto desactivado");
    setPinCurrent("");
  };

  const changePin = async () => {
    if (!settings.pinHash) {
      return;
    }
    const currentHash = await hashPin(pinCurrent);
    if (currentHash !== settings.pinHash) {
      setStatus("PIN actual incorrecto");
      return;
    }
    if (!pinChangeNew || pinChangeNew !== pinChangeConfirm) {
      setStatus("Nuevo PIN no coincide");
      return;
    }
    const newHash = await hashPin(pinChangeNew);
    await saveSettings({ ...settings, pinHash: newHash }, "PIN actualizado");
    setPinCurrent("");
    setPinChangeNew("");
    setPinChangeConfirm("");
  };

  // Export y reset de metricas.
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
    if (!window.confirm("Reiniciar metricas?")) {
      return;
    }
    await resetMetrics();
    const storedMetrics = await getMetrics();
    setMetrics(storedMetrics);
    setStatus("Metricas reiniciadas");
    setTimeout(() => setStatus(""), 2000);
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
      await saveSettings(next, "Configuracion importada");
    } catch {
      setStatus("Archivo invalido");
    }
  };

  // Permisos por dominio.
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
      setStatus("Dominio invalido");
      return;
    }
    if (settings.blockedDomains.includes(domain)) {
      setStatus("Dominio ya agregado");
      return;
    }
    const granted = await requestDomainPermission(domain);
    if (!granted) {
      setStatus("Permiso denegado");
      return;
    }
    const next = Array.from(new Set([...settings.blockedDomains, domain]));
    setBlockedDomainInput("");
    await saveSettings({ ...settings, blockedDomains: next }, "Dominio agregado");
  };

  const removeBlockedDomain = async (domain: string) => {
    const next = settings.blockedDomains.filter((entry) => entry !== domain);
    await saveSettings({ ...settings, blockedDomains: next });
    void removeDomainPermission(domain);
  };

  // Panel dependiente de estado de strict mode.
  const strictModePanel = useMemo(() => {
    if (!settings.strictMode) {
      return (
        <div className="panel">
          <h3>Modo estricto</h3>
          <p>Activa para bloquear desbloqueo temporal.</p>
          <div className="grid">
            <input
              type="password"
              placeholder="PIN"
              value={pinInput}
              onChange={(event) => setPinInput(event.target.value)}
            />
            <input
              type="password"
              placeholder="Confirmar PIN"
              value={pinConfirm}
              onChange={(event) => setPinConfirm(event.target.value)}
            />
          </div>
          <button onClick={enableStrictMode}>Activar modo estricto</button>
        </div>
      );
    }
    return (
      <div className="panel">
        <h3>Modo estricto activo</h3>
        <p>Para desactivar requiere PIN.</p>
        <div className="grid">
          <input
            type="password"
            placeholder="PIN actual"
            value={pinCurrent}
            onChange={(event) => setPinCurrent(event.target.value)}
          />
        </div>
        <div className="actions">
          <button onClick={disableStrictMode}>Desactivar</button>
        </div>
        <div className="divider" />
        <div className="grid">
          <input
            type="password"
            placeholder="Nuevo PIN"
            value={pinChangeNew}
            onChange={(event) => setPinChangeNew(event.target.value)}
          />
          <input
            type="password"
            placeholder="Confirmar nuevo PIN"
            value={pinChangeConfirm}
            onChange={(event) => setPinChangeConfirm(event.target.value)}
          />
        </div>
        <div className="actions">
          <button onClick={changePin}>Cambiar PIN</button>
        </div>
      </div>
    );
  }, [settings, pinInput, pinConfirm, pinCurrent, pinChangeNew, pinChangeConfirm]);

  return (
    <div className="options">
      <header>
        <h1>FocusTube Blocker</h1>
        <p>Configura horarios, whitelist y modo estricto.</p>
      </header>

      {status ? <div className="status">{status}</div> : null}

      <section className="panel">
        <h3>Bloqueos</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.blockShorts}
            onChange={(event) => saveSettings({ ...settings, blockShorts: event.target.checked })}
          />
          Bloquear Shorts
        </label>
        <label>
          <input
            type="checkbox"
            checked={settings.blockKids}
            onChange={(event) => saveSettings({ ...settings, blockKids: event.target.checked })}
          />
          Bloquear YouTube Kids
        </label>
      </section>

      <section className="panel">
        <h3>Formato de hora</h3>
        <label>
          <input
            type="checkbox"
            checked={settings.timeFormat12h}
            onChange={(event) => saveSettings({ ...settings, timeFormat12h: event.target.checked })}
          />
          Usar formato 12 horas (AM/PM)
        </label>
      </section>

      <ScheduleView
        intervalsByDay={settings.intervalsByDay}
        timeFormat12h={settings.timeFormat12h}
        onChange={(next) => saveSettings({ ...settings, intervalsByDay: next })}
      />

      <section className="panel">
        <h3>Whitelist</h3>
        <div className="row">
          <input
            type="text"
            placeholder="https://youtube.com/@MITOpenCourseWare"
            value={whitelistInput}
            onChange={(event) => setWhitelistInput(event.target.value)}
          />
          <button onClick={addWhitelist}>Agregar</button>
        </div>
        <ul className="list">
          {settings.whitelist.length === 0 ? <li>Sin entradas.</li> : null}
          {settings.whitelist.map((entry) => (
            <li key={entry}>
              <span>{entry}</span>
              <button onClick={() => removeWhitelist(entry)}>Eliminar</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h3>Sitios bloqueados</h3>
        <div className="row">
          <input
            type="text"
            placeholder="youtube.com o https://www.tiktok.com/@x"
            value={blockedDomainInput}
            onChange={(event) => setBlockedDomainInput(event.target.value)}
          />
          <button onClick={addBlockedDomain}>Agregar</button>
        </div>
        <ul className="list">
          {settings.blockedDomains.length === 0 ? <li>Sin entradas.</li> : null}
          {settings.blockedDomains.map((entry) => (
            <li key={entry}>
              <span>{entry}</span>
              <button onClick={() => removeBlockedDomain(entry)}>Eliminar</button>
            </li>
          ))}
        </ul>
      </section>

      {strictModePanel}

            {/* Dashboard de metricas */}
      <section className="panel">
        <h3>Dashboard</h3>
        {!metrics ? (
          <p>Cargando metricas...</p>
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
                      <h4>Hoy</h4>
                      <div>Intentos: {attemptsToday}</div>
                      <div>Tiempo: {formatSeconds(timeToday)}</div>
                      <div>Sesiones: {sessionsToday}</div>
                    </div>
                    <div className="summary-card">
                      <h4>Ultimos 7 dias</h4>
                      <div>Intentos: {sum(last7, "attemptsByDay")}</div>
                      <div>Tiempo: {formatSeconds(sum(last7, "timeByDay"))}</div>
                    </div>
                    <div className="summary-card">
                      <h4>Ultimos 30 dias</h4>
                      <div>Intentos: {sum(last30, "attemptsByDay")}</div>
                      <div>Tiempo: {formatSeconds(sum(last30, "timeByDay"))}</div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="charts">
              {(() => {
                const days = getRecentDays(14).reverse();
                const attempts = days.map((day) => metrics.attemptsByDay[day] || 0);
                const times = days.map((day) => metrics.timeByDay[day] || 0);
                const maxAttempts = Math.max(1, ...attempts);
                const maxTime = Math.max(1, ...times);
                return (
                  <>
                    <div className="chart">
                      <h4>Intentos por dia</h4>
                      <div className="bars">
                        {days.map((day, index) => (
                          <div key={day} className="bar" title={`${day}: ${attempts[index]}`}>
                            <div
                              className="fill"
                              style={{ height: `${(attempts[index] / maxAttempts) * 100}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="chart">
                      <h4>Tiempo por dia</h4>
                      <div className="bars">
                        {days.map((day, index) => (
                          <div key={day} className="bar" title={`${day}: ${formatSeconds(times[index])}`}>
                            <div
                              className="fill"
                              style={{ height: `${(times[index] / maxTime) * 100}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="table">
              <div className="row header">
                <span>Fecha</span>
                <span>Intentos</span>
                <span>Tiempo</span>
                <span>Sesiones</span>
                <span>Top dominio</span>
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
              <button onClick={exportMetrics}>Exportar metricas JSON</button>
              <button onClick={handleResetMetrics}>Reset metricas</button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Exportar / Importar</h3>
        <div className="actions">
          <button onClick={exportSettings}>Exportar JSON</button>
          <label className="import">
            Importar JSON
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

// Valida entradas de whitelist.
function isWhitelistValid(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.length > 1;
  }
  return trimmed.includes("youtube.com") || trimmed.includes("youtu.be");
}

// Normaliza settings importados contra defaults.
function normalizeSettings(data: Partial<Settings>): Settings {
  const merged: Settings = {
    ...DEFAULT_SETTINGS,
    ...data,
    schedules: data.schedules || DEFAULT_SETTINGS.schedules,
    intervalsByDay: data.intervalsByDay || DEFAULT_SETTINGS.intervalsByDay,
    whitelist: Array.isArray(data.whitelist) ? data.whitelist : DEFAULT_SETTINGS.whitelist,
    blockedDomains: Array.isArray(data.blockedDomains)
      ? data.blockedDomains
      : DEFAULT_SETTINGS.blockedDomains
  };
  return merged;
}
