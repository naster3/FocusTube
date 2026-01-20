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
  /** Proximo inicio/fin de bloqueo por horario (si existe). */
  nextBlockStart: number | null;
  nextBlockEnd: number | null;
};

type AbsWindow = { start: number; end: number };

function minutesToDate(baseDay: Date, minutes: number) {
  const d = new Date(baseDay);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

function getBlockedIntervalsForDay(intervalsByDay: IntervalWeek, dayIdx: number) {
  const intervals = intervalsByDay[dayIdx] ?? [];
  return intervals.filter((i) => i.enabled && i.mode === "blocked");
}

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
      out.push({ start, end });
      continue;
    }

    const nextDay = new Date(day0);
    nextDay.setDate(nextDay.getDate() + 1);
    const end = minutesToDate(nextDay, endM).getTime();
    out.push({ start, end });
  }

  return out.sort((a, b) => a.start - b.start);
}

function findCurrentWindow(now: number, intervalsByDay: IntervalWeek): AbsWindow | null {
  const d = new Date(now);
  const today = new Date(d);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const wToday = buildDayWindows(today, intervalsByDay);
  const wY = buildDayWindows(yesterday, intervalsByDay).filter((w) => w.end > today.getTime());
  const windows = [...wY, ...wToday].sort((a, b) => a.start - b.start);

  for (const w of windows) {
    if (now >= w.start && now < w.end) return w;
  }
  return null;
}

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

// Calcula estado actual de bloqueo por horario.
export function computeScheduleTimeline(settings: Settings, now = Date.now()): ScheduleTimeline {
  if (settings.blockEnabled) {
    if (isWeeklySessionActive(settings, now)) {
      const until = settings.weeklyUnblockUntil ?? null;
      return {
        state: "free",
        reason: "weekly_unblock",
        currentUntil: until,
        nextChangeAt: until,
        nextBlockStart: until,
        nextBlockEnd: null
      };
    }
    return {
      state: "blocked",
      reason: "manual",
      currentUntil: null,
      nextChangeAt: null,
      nextBlockStart: null,
      nextBlockEnd: null
    };
  }

  const current = findCurrentWindow(now, settings.intervalsByDay);

  if (current) {
    if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
      const freeUntil = Math.min(settings.unblockUntil, current.end);
      return {
        state: "free",
        reason: "temporary_unblock",
        currentUntil: freeUntil,
        nextChangeAt: freeUntil,
        nextBlockStart: freeUntil,
        nextBlockEnd: current.end
      };
    }

    return {
      state: "blocked",
      reason: "schedule",
      currentUntil: current.end,
      nextChangeAt: current.end,
      nextBlockStart: null,
      nextBlockEnd: null
    };
  }

  const next = findNextWindow(now, settings.intervalsByDay);
  return {
    state: "free",
    reason: "schedule_free",
    currentUntil: next ? next.start : null,
    nextChangeAt: next ? next.start : null,
    nextBlockStart: next ? next.start : null,
    nextBlockEnd: next ? next.end : null
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
