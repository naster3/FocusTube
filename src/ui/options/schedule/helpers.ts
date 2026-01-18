import type { Interval } from "../../../shared/types";

export type Segment = {
  id: string;
  startMin: number;
  endMin: number;
  mode: "blocked" | "free";
  periodLabel: string;
};

// Periodos fijos del dia.
const PERIODS = [
  { label: "Madrugada", start: 0, end: 360 },
  { label: "Mañana", start: 360, end: 720 },
  { label: "Mediodía", start: 720, end: 840 },
  { label: "Tarde", start: 840, end: 1200 },
  { label: "Noche", start: 1200, end: 1440 }
];

// Convierte HH:MM a minutos.
export function parseTimeToMinutes(value: "HH:MM"): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// Convierte minutos a HH:MM.
export function minutesToTime(total: number): "HH:MM" {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}` as "HH:MM";
}

// Obtiene etiqueta de periodo por minuto.
function getPeriodLabel(minute: number) {
  const period = PERIODS.find((p) => minute >= p.start && minute < p.end);
  return period ? period.label : "Noche";
}

// Divide intervalos que cruzan medianoche.
function expandIntervalToRanges(startMin: number, endMin: number) {
  if (endMin > startMin) {
    return [{ startMin, endMin }];
  }
  if (endMin < startMin) {
    return [
      { startMin, endMin: 1440 },
      { startMin: 0, endMin }
    ];
  }
  return [];
}

// Calcula modo final por minuto con precedencia blocked.
function buildMinuteModes(intervals: Interval[]) {
  const minutes = Array<"free" | "blocked">(1440).fill("free");
  const blockedMask = new Array(1440).fill(false);

  intervals
    .filter((i) => i.enabled)
    .forEach((interval) => {
      const startMin = parseTimeToMinutes(interval.start);
      const endMin = parseTimeToMinutes(interval.end);
      const ranges = expandIntervalToRanges(startMin, endMin);

      for (const r of ranges) {
        for (let m = r.startMin; m < r.endMin; m += 1) {
          if (interval.mode === "blocked") {
            minutes[m] = "blocked";
            blockedMask[m] = true;
          } else if (!blockedMask[m]) {
            minutes[m] = "free";
          }
        }
      }
    });

  return minutes;
}

// Normaliza intervalos a segmentos renderizables.
export function normalizeIntervals(intervals: Interval[]): Segment[] {
  const minutes = buildMinuteModes(intervals);
  const segments: Segment[] = [];

  let startMin = 0;
  let currentMode = minutes[0];
  let currentPeriod = getPeriodLabel(0);

  for (let m = 1; m <= 1440; m += 1) {
    const mode = m < 1440 ? minutes[m] : currentMode;
    const period = m < 1440 ? getPeriodLabel(m) : currentPeriod;

    if (mode !== currentMode || period !== currentPeriod || m === 1440) {
      segments.push({
        id: `${currentMode}-${currentPeriod}-${startMin}`,
        startMin,
        endMin: m,
        mode: currentMode,
        periodLabel: currentPeriod
      });
      startMin = m;
      currentMode = mode;
      currentPeriod = period;
    }
  }

  return segments;
}

// Detecta solapamientos minuto a minuto.
export function detectOverlaps(intervals: Interval[]) {
  const counts = new Array(1440).fill(0);

  intervals
    .filter((i) => i.enabled)
    .forEach((interval) => {
      const startMin = parseTimeToMinutes(interval.start);
      const endMin = parseTimeToMinutes(interval.end);
      const ranges = expandIntervalToRanges(startMin, endMin);

      for (const r of ranges) {
        for (let m = r.startMin; m < r.endMin; m += 1) {
          counts[m] += 1;
        }
      }
    });

  const overlaps: { startMin: number; endMin: number }[] = [];
  let inOverlap = false;
  let overlapStart = 0;

  for (let m = 0; m <= 1440; m += 1) {
    const isOverlap = m < 1440 && counts[m] > 1;
    if (isOverlap && !inOverlap) {
      inOverlap = true;
      overlapStart = m;
    }
    if ((!isOverlap || m === 1440) && inOverlap) {
      overlaps.push({ startMin: overlapStart, endMin: m });
      inOverlap = false;
    }
  }

  return overlaps;
}

// Calcula totales bloqueado/libre en minutos.
export function computeTotals(intervals: Interval[]) {
  const minutes = buildMinuteModes(intervals);
  const blockedMinutes = minutes.filter((m) => m === "blocked").length;
  const freeMinutes = 1440 - blockedMinutes;
  return { blockedMinutes, freeMinutes };
}
