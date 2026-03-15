// Utilidades para calcular el timeline de bloqueo segun horarios y modos especiales.
import type { IntervalWeek, Settings } from "../settings/types";
import { parseTimeToMinutes } from "./schedule";
import { isWeeklySessionActive } from "../weekly/weekly";

export type ScheduleTimeline = {
  state: "blocked" | "free";
  /** Por que el estado actual esta asi (solo por horario/manual/desbloqueo temporal). */
  reason: "manual" | "schedule" | "temporary_unblock" | "schedule_free" | "weekly_unblock";
  /** Timestamp (ms) cuando termina el estado actual. */
  currentUntil: number | null;
  nextChangeAt: number | null;
  /** Ventana horaria que origina el estado actual, cuando aplica. */
  currentBlockStart: number | null;
  currentBlockEnd: number | null;
  currentSourceDay: number | null;
  isCarryover: boolean;
  /** Proximo inicio/fin de bloqueo por horario (si existe). */
  nextBlockStart: number | null;
  nextBlockEnd: number | null;
  nextBlockSourceDay: number | null;
};

type AbsWindow = { start: number; end: number; sourceDay: number };

function minutesToDate(baseDay: Date, minutes: number) {
  const d = new Date(baseDay);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

// Filtra intervalos activos marcados como bloqueados para un dia.
function getBlockedIntervalsForDay(intervalsByDay: IntervalWeek, dayIdx: number) {
  const intervals = intervalsByDay[dayIdx] ?? [];
  return intervals.filter((i) => i.enabled !== false && i.mode === "blocked");
}

// Construye ventanas absolutas (timestamps) de bloqueo para un dia, considerando cruces de medianoche.
function buildDayWindows(dayStart: Date, intervalsByDay: IntervalWeek): AbsWindow[] {
  const day0 = new Date(dayStart);
  day0.setHours(0, 0, 0, 0);
  const out: AbsWindow[] = [];
  const dayIdx = day0.getDay();
  const ranges = getBlockedIntervalsForDay(intervalsByDay, dayIdx);

  for (const r of ranges) {
    const startM = parseTimeToMinutes(r.start);
    const endM = parseTimeToMinutes(r.end);
    if (startM === endM) continue;

    const start = minutesToDate(day0, startM).getTime();

    if (endM > startM) {
      const end = minutesToDate(day0, endM).getTime();
      out.push({ start, end, sourceDay: dayIdx });
      continue;
    }

    const nextDay = new Date(day0);
    nextDay.setDate(nextDay.getDate() + 1);
    const end = minutesToDate(nextDay, endM).getTime();
    out.push({ start, end, sourceDay: dayIdx });
  }

  return out.sort((a, b) => a.start - b.start);
}

// Busca la ventana de bloqueo actual, considerando el dia anterior (cruce de medianoche).
function findCurrentWindow(now: number, intervalsByDay: IntervalWeek): AbsWindow | null {
  const d = new Date(now);
  const today = new Date(d);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Un intervalo 23:00-02:00 vive en el dia anterior, por eso combinamos ambas listas.
  const wToday = buildDayWindows(today, intervalsByDay);
  const wY = buildDayWindows(yesterday, intervalsByDay).filter((w) => w.end > today.getTime());
  const windows = [...wY, ...wToday].sort((a, b) => a.start - b.start);

  for (const w of windows) {
    if (now >= w.start && now < w.end) return w;
  }
  return null;
}

// Busca la proxima ventana de bloqueo a partir de "now".
function findNextWindow(now: number, intervalsByDay: IntervalWeek): AbsWindow | null {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  // Buscamos hasta 8 dias por seguridad
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(base);
    day.setDate(day.getDate() + offset);
    const windows = buildDayWindows(day, intervalsByDay);
    for (const w of windows) {
      if (w.start > now) return w;
    }
  }
  return null;
}

// Calcula el estado actual segun bloqueo manual, desbloqueo semanal y horarios.
export function computeScheduleTimeline(settings: Settings, now = Date.now()): ScheduleTimeline {
  const currentDay = new Date(now).getDay();
  if (settings.blockEnabled) {
    // Bloqueo permanente: puede habilitar excepcion por sesion semanal.
    if (isWeeklySessionActive(settings, now)) {
      const until = settings.weeklyUnblockUntil ?? null;
      return {
        state: "free",
        reason: "weekly_unblock",
        currentUntil: until,
        nextChangeAt: until,
        currentBlockStart: null,
        currentBlockEnd: null,
        currentSourceDay: null,
        isCarryover: false,
        nextBlockStart: until,
        nextBlockEnd: null,
        nextBlockSourceDay: null,
      };
    }
    return {
      state: "blocked",
      reason: "manual",
      currentUntil: null,
      nextChangeAt: null,
      currentBlockStart: null,
      currentBlockEnd: null,
      currentSourceDay: null,
      isCarryover: false,
      nextBlockStart: null,
      nextBlockEnd: null,
      nextBlockSourceDay: null,
    };
  }

  const current = findCurrentWindow(now, settings.intervalsByDay);

  if (current) {
    const isCarryover = current.sourceDay !== currentDay;
    // Dentro de un intervalo bloqueado, puede haber desbloqueo temporal.
    if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
      // El desbloqueo nunca se extiende mas alla del final del bloque horario actual.
      const freeUntil = Math.min(settings.unblockUntil, current.end);
      return {
        state: "free",
        reason: "temporary_unblock",
        currentUntil: freeUntil,
        nextChangeAt: freeUntil,
        currentBlockStart: current.start,
        currentBlockEnd: current.end,
        currentSourceDay: current.sourceDay,
        isCarryover,
        nextBlockStart: freeUntil,
        nextBlockEnd: current.end,
        nextBlockSourceDay: current.sourceDay,
      };
    }

    return {
      state: "blocked",
      reason: "schedule",
      currentUntil: current.end,
      nextChangeAt: current.end,
      currentBlockStart: current.start,
      currentBlockEnd: current.end,
      currentSourceDay: current.sourceDay,
      isCarryover,
      nextBlockStart: null,
      nextBlockEnd: null,
      nextBlockSourceDay: null,
    };
  }

  const next = findNextWindow(now, settings.intervalsByDay);
  // Si no existe proximo bloque, la UI interpreta `null` como "sin cambios programados".
  return {
    state: "free",
    reason: "schedule_free",
    currentUntil: next ? next.start : null,
    nextChangeAt: next ? next.start : null,
    currentBlockStart: null,
    currentBlockEnd: null,
    currentSourceDay: null,
    isCarryover: false,
    nextBlockStart: next ? next.start : null,
    nextBlockEnd: next ? next.end : null,
    nextBlockSourceDay: next ? next.sourceDay : null,
  };
}

// Formatea duracion en HH:MM:SS.
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}
