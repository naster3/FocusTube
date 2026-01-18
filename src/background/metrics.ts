import { flushToDb } from "../shared/db";
import { setMetrics } from "../shared/storage";
import type { DailyDelta, DbEvent } from "../shared/db";
import { ensureMetricsLoaded, getMetricsCache, getTabState, isMetricsDirty, isWindowFocused, setMetricsDirty } from "./state";
import { tabStates } from "./state";

// Ritmos de tracking y flush de metricas.
export const TICK_MS = 5000;
export const FLUSH_MS = 20000;
const SESSION_IDLE_MS = 60000;
const ATTEMPT_COOLDOWN_MS = 5000;

// Cola para persistir data en IndexedDB (DB) sin escribir cada tick.
const pendingDbEvents: Omit<DbEvent, "id">[] = [];
const pendingDailyDeltas = new Map<string, DailyDelta>();

// Encola eventos para flush a DB.
function queueDbEvent(event: Omit<DbEvent, "id">) {
  pendingDbEvents.push(event);
}

// Mergea deltas diarios en memoria.
function mergeDailyDelta(day: string, delta: DailyDelta) {
  const current = pendingDailyDeltas.get(day) || {};
  const merged: DailyDelta = {
    attempts: (current.attempts || 0) + (delta.attempts || 0),
    time: (current.time || 0) + (delta.time || 0),
    blockedTime: (current.blockedTime || 0) + (delta.blockedTime || 0),
    sessions: (current.sessions || 0) + (delta.sessions || 0),
    updatedAt: delta.updatedAt || current.updatedAt
  };

  const byDomain: Record<string, number> = { ...(current.timeByDomain || {}) };
  if (delta.timeByDomain) {
    for (const [domain, sec] of Object.entries(delta.timeByDomain)) {
      byDomain[domain] = (byDomain[domain] || 0) + sec;
    }
  }
  if (Object.keys(byDomain).length > 0) {
    merged.timeByDomain = byDomain;
  }

  pendingDailyDeltas.set(day, merged);
}

// Escribe en DB en batch.
async function flushDb() {
  if (pendingDbEvents.length === 0 && pendingDailyDeltas.size === 0) {
    return;
  }
  const events = pendingDbEvents.splice(0, pendingDbEvents.length);
  const deltas = new Map(pendingDailyDeltas);
  pendingDailyDeltas.clear();
  await flushToDb(events, deltas);
}

// Helpers basicos de fecha.
function getDayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

// Inicia una sesion cuando se entra a un dominio objetivo.
export async function startSession(tabId: number, now: number) {
  const metrics = await ensureMetricsLoaded();
  const state = getTabState(tabId);
  if (state.sessionActive) {
    return;
  }
  state.sessionActive = true;
  state.lastActiveAt = now;
  const dayKey = getDayKey(now);
  const nextCount = (metrics.sessionsByDay[dayKey] || 0) + 1;
  metrics.sessionsByDay = { ...metrics.sessionsByDay, [dayKey]: nextCount };
  metrics.lastUpdatedAt = now;
  setMetricsDirty(true);

  // DB: registra evento y agregado diario.
  queueDbEvent({
    ts: now,
    day: dayKey,
    type: "session_start",
    domain: state.domain,
    tabId,
    url: null
  });
  mergeDailyDelta(dayKey, { sessions: 1, updatedAt: now });
}

// Acumula tiempo total y por dominio.
async function addTime(domain: string, deltaSec: number, now: number) {
  const metrics = await ensureMetricsLoaded();
  const dayKey = getDayKey(now);
  metrics.timeByDay = {
    ...metrics.timeByDay,
    [dayKey]: (metrics.timeByDay[dayKey] || 0) + deltaSec
  };
  const dayDomains = metrics.timeByDomainByDay[dayKey] || {};
  metrics.timeByDomainByDay = {
    ...metrics.timeByDomainByDay,
    [dayKey]: {
      ...dayDomains,
      [domain]: (dayDomains[domain] || 0) + deltaSec
    }
  };
  metrics.lastUpdatedAt = now;
  setMetricsDirty(true);

  // DB: registra evento y agregado diario.
  queueDbEvent({ ts: now, day: dayKey, type: "time", domain, deltaSec, tabId: null, url: null });
  mergeDailyDelta(dayKey, { time: deltaSec, timeByDomain: { [domain]: deltaSec }, updatedAt: now });
}

// Acumula tiempo en pantalla de bloqueo.
export async function addBlockedTime(deltaSec: number, now: number) {
  const metrics = await ensureMetricsLoaded();
  const dayKey = getDayKey(now);
  metrics.blockedTimeByDay = {
    ...metrics.blockedTimeByDay,
    [dayKey]: (metrics.blockedTimeByDay[dayKey] || 0) + deltaSec
  };
  metrics.lastUpdatedAt = now;
  setMetricsDirty(true);

  // DB: registra evento y agregado diario.
  queueDbEvent({ ts: now, day: dayKey, type: "blocked_time", domain: null, deltaSec, tabId: null, url: null });
  mergeDailyDelta(dayKey, { blockedTime: deltaSec, updatedAt: now });
}

// Incrementa intentos con cooldown por pestana.
export async function addAttempt(tabId: number, url: string, now: number) {
  const metrics = await ensureMetricsLoaded();
  const state = getTabState(tabId);
  if (state.lastAttemptAt && state.lastAttemptUrl === url && now - state.lastAttemptAt < ATTEMPT_COOLDOWN_MS) {
    return;
  }
  state.lastAttemptAt = now;
  state.lastAttemptUrl = url;
  const dayKey = getDayKey(now);
  const nextCount = (metrics.attemptsByDay[dayKey] || 0) + 1;
  metrics.attemptsByDay = { ...metrics.attemptsByDay, [dayKey]: nextCount };
  metrics.lastAttemptAt = now;
  metrics.lastUpdatedAt = now;
  setMetricsDirty(true);

  // DB: registra evento y agregado diario.
  queueDbEvent({ ts: now, day: dayKey, type: "attempt", domain: state.domain, url, deltaSec: null, tabId });
  mergeDailyDelta(dayKey, { attempts: 1, updatedAt: now });
}

// Tick global que acumula tiempo si la pestana esta activa/visible.
export async function tickMetrics() {
  const now = Date.now();
  for (const [tabId, state] of tabStates.entries()) {
    const eligible = state.active && isWindowFocused() && state.visible && state.isTarget && state.domain;
    if (eligible && state.domain) {
      const last = state.lastTick ?? now;
      const deltaSec = Math.floor((now - last) / 1000);
      if (deltaSec > 0) {
        await addTime(state.domain, deltaSec, now);
        state.lastTick = now;
        state.lastActiveAt = now;
      } else {
        state.lastTick = now;
      }
    } else {
      state.lastTick = now;
    }

    if (state.sessionActive) {
      if (!state.isTarget) {
        state.sessionActive = false;
      } else if (!eligible && state.lastActiveAt && now - state.lastActiveAt > SESSION_IDLE_MS) {
        state.sessionActive = false;
      }
    }
  }
}

// Persiste metricas en batch para evitar writes constantes.
export async function flushMetrics() {
  if (!isMetricsDirty() || !getMetricsCache()) {
    // Igual puede haber data pendiente de DB (si en el futuro logueamos cosas sin tocar metrics).
    await flushDb();
    return;
  }
  const metrics = getMetricsCache();
  if (!metrics) {
    await flushDb();
    return;
  }
  metrics.version = 2;
  await setMetrics(metrics);
  setMetricsDirty(false);
  await flushDb();
}
