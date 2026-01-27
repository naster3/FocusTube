import type { Settings } from "../settings/types";

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isWeeklySessionActive(settings: Settings, now = Date.now()) {
  return Boolean(settings.weeklyUnblockEnabled && settings.weeklyUnblockUntil && now < settings.weeklyUnblockUntil);
}

export function canStartWeeklySession(settings: Settings, now = Date.now()) {
  if (!settings.weeklyUnblockEnabled) return false;
  const today = new Date(now);
  const allowedDays = settings.weeklyUnblockDays ?? [];
  if (!allowedDays.includes(today.getDay())) return false;
  const dayKey = getLocalDayKey(today);
  return settings.weeklyUnblockLastWeek !== dayKey;
}

export function getWeeklySessionDayKey(now = Date.now()) {
  return getLocalDayKey(new Date(now));
}

export function getWeeklySessionDurationMs(settings: Settings) {
  const minutes = Math.max(1, Math.floor(settings.weeklyUnblockDurationMinutes));
  return minutes * 60 * 1000;
}
