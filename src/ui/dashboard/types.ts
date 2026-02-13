export type ChartSeries = {
  labels: string[];
  attempts: number[];
  times: number[];
};

export type PieSeries = {
  labels: string[];
  values: number[];
};

export type SummaryData = {
  attemptsToday: number;
  timeToday: number;
  sessionsToday: number;
  attemptsWeek: number;
  attemptsPrev: number;
  timeWeek: number;
  timePrev: number;
  sessionsWeek: number;
  sessionsPrev: number;
  last30Attempts: number;
  last30Time: number;
  todayLabel: string;
  weekLabel: string;
  monthLabel: string;
};

export type AdvancedData = {
  attempts30: number;
  attemptsPrev30: number;
  time30: number;
  timePrev30: number;
  sessions30: number;
  sessionsPrev30: number;
  topDomains: Array<[string, number]>;
};

export type MetricsTableRow = {
  day: string;
  attempts: number;
  time: number;
  sessions: number;
  topDomainLabel: string;
};
