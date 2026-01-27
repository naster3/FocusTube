export type DbEventType = "attempt" | "time" | "blocked_time" | "session_start";

export type DbEvent = {
  id?: number;
  ts: number;
  day: string; // YYYY-MM-DD
  type: DbEventType;
  domain?: string | null;
  url?: string | null;
  deltaSec?: number | null;
  tabId?: number | null;
};

export type DailyStats = {
  day: string;
  attempts: number;
  time: number;
  blockedTime: number;
  sessions: number;
  timeByDomain: Record<string, number>;
  updatedAt: number;
};

export type DailyDelta = {
  attempts?: number;
  time?: number;
  blockedTime?: number;
  sessions?: number;
  timeByDomain?: Record<string, number>;
  updatedAt?: number;
};
