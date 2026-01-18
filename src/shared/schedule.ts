import { IntervalWeek } from "./types";

// Convierte HH:MM a minutos.
export function parseTimeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return 0;
  }
  return h * 60 + m;
}

// Evalua si la fecha cae dentro de horarios bloqueados.
export function isWithinBlockedSchedule(date: Date, intervalsByDay: IntervalWeek) {
  const day = date.getDay();
  const minutes = date.getHours() * 60 + date.getMinutes();
  const todayIntervals = intervalsByDay[day] || [];
  const prevDay = (day + 6) % 7;
  const prevIntervals = intervalsByDay[prevDay] || [];

  const inToday = todayIntervals.some((interval) => {
    if (!interval.enabled || interval.mode !== "blocked") {
      return false;
    }
    const start = parseTimeToMinutes(interval.start);
    const end = parseTimeToMinutes(interval.end);
    if (start === end) {
      return false;
    }
    if (end > start) {
      return minutes >= start && minutes < end;
    }
    return minutes >= start;
  });
  if (inToday) {
    return true;
  }

  const inPrevCross = prevIntervals.some((interval) => {
    if (!interval.enabled || interval.mode !== "blocked") {
      return false;
    }
    const start = parseTimeToMinutes(interval.start);
    const end = parseTimeToMinutes(interval.end);
    if (start === end || end > start) {
      return false;
    }
    return minutes < end;
  });

  return inPrevCross;
}
