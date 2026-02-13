import type { Metrics } from "../settings/types";

export const formatSeconds = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
};

export const getDayKey = (date: Date) => date.toISOString().slice(0, 10);

export const getRecentDays = (count: number) => {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(getDayKey(d));
  }
  return days;
};

export const percentDelta = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? "0%" : "+100%";
  }
  const delta = ((current - previous) / previous) * 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
};

export const deltaClass = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? "neutral" : "positive";
  }
  if (current === previous) return "neutral";
  return current > previous ? "positive" : "negative";
};

export const sumMetricRange = (metrics: Metrics, keys: string[], field: keyof Metrics) =>
  keys.reduce((acc, key) => acc + ((metrics[field] as Record<string, number>)[key] || 0), 0);
