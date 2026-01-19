import type { Settings } from "./types";

const WEEKLY_UNBLOCK_DAY = 1;

function getIsoWeekKey(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function isWeeklySessionActive(settings: Settings, now = Date.now()) {
  return Boolean(settings.weeklyUnblockEnabled && settings.weeklyUnblockUntil && now < settings.weeklyUnblockUntil);
}

export function canStartWeeklySession(settings: Settings, now = Date.now()) {
  if (!settings.weeklyUnblockEnabled) return false;
  const today = new Date(now);
  if (today.getDay() !== WEEKLY_UNBLOCK_DAY) return false;
  const weekKey = getIsoWeekKey(today);
  return settings.weeklyUnblockLastWeek !== weekKey;
}

export function getWeeklySessionWeekKey(now = Date.now()) {
  return getIsoWeekKey(new Date(now));
}

export function getWeeklySessionDurationMs(settings: Settings) {
  const minutes = Math.max(1, Math.floor(settings.weeklyUnblockDurationMinutes));
  return minutes * 60 * 1000;
}

