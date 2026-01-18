// Tipos compartidos para settings y metrics.
export type TimeRange = {
  start: string;
  end: string;
};

export type WeekSchedule = Record<number, TimeRange[]>;

export type Interval = {
  id: string;
  start: "HH:MM";
  end: "HH:MM";
  mode: "blocked" | "free";
  enabled: boolean;
};

export type IntervalWeek = Record<number, Interval[]>;

export type Settings = {
  blockEnabled: boolean;
  blockShorts: boolean;
  blockKids: boolean;
  strictMode: boolean;
  pinHash: string | null;
  blockedDomains: string[];
  whitelist: string[];
  schedules: WeekSchedule;
  intervalsByDay: IntervalWeek;
  timeFormat12h: boolean;
  unblockUntil: number | null;
};

export type Metrics = {
  version: number;
  attemptsByDay: Record<string, number>;
  timeByDay: Record<string, number>;
  blockedTimeByDay: Record<string, number>;
  sessionsByDay: Record<string, number>;
  timeByDomainByDay: Record<string, Record<string, number>>;
  lastAttemptAt: number | null;
  lastUpdatedAt: number | null;
};

export type BlockReason = "manual" | "schedule" | "shorts" | "kids" | "not_target" | "unknown";

export type BlockDecision = {
  blocked: boolean;
  reason?: BlockReason;
};
