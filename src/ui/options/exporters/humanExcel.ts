import type { Interval, Metrics, Settings } from "../../../domain/settings/types";
import { t } from "../../../shared/i18n";
import { formatDate, formatDateTime, getDayLabel } from "../../../shared/i18n/dates";

export type SheetData = {
  name: string;
  rows: Array<Array<string | number>>;
  colWidths?: number[];
};

type KeyValueItem = { label: string; value: string };

const METRICS_DAYS = 30;
const RAW_SHEET_NAME = "00 Raw JSON";

const languageLabels: Record<Settings["language"], string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
  fr: "FR"
};

const yesNo = (lang: Settings["language"], value: boolean) =>
  value ? t(lang, "options.data.pdf.value.yes") : t(lang, "options.data.pdf.value.no");

const truncateSheetName = (name: string) => name.slice(0, 31);
const sheetName = (order: number, label: string) => truncateSheetName(`${String(order).padStart(2, "0")} ${label}`);

const roundMinutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10;

const formatMinutesLabel = (lang: Settings["language"], seconds: number) => {
  const minutes = roundMinutes(seconds);
  return `${minutes} ${t(lang, "options.weekly_unblock.minutes")}`;
};

const formatTimeString = (value: string, use12h: boolean) => {
  if (!use12h) {
    return value;
  }
  const [h, m] = value.split(":");
  const hours = Number(h);
  if (!Number.isFinite(hours)) {
    return value;
  }
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${m} ${suffix}`;
};

const getDayKey = (date: Date) => date.toISOString().slice(0, 10);

const getRecentDays = (count: number) => {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i += 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(getDayKey(d));
  }
  return days;
};

const sumValues = (values: Record<string, number>) =>
  Object.values(values).reduce((acc, value) => acc + (Number.isFinite(value) ? value : 0), 0);

const aggregateDomains = (metrics: Metrics) => {
  const totals: Record<string, number> = {};
  Object.values(metrics.timeByDomainByDay).forEach((day) => {
    Object.entries(day).forEach(([domain, seconds]) => {
      totals[domain] = (totals[domain] || 0) + (Number.isFinite(seconds) ? seconds : 0);
    });
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
};

const buildKeyValueRows = (items: KeyValueItem[], lang: Settings["language"]) => {
  const header = [t(lang, "options.data.excel.header.label"), t(lang, "options.data.excel.header.value")];
  return [header, ...items.map((item) => [item.label, item.value])];
};

const buildRawSheet = (payload: unknown): SheetData => ({
  name: RAW_SHEET_NAME,
  rows: [["key", "value"], ["__raw_json__", JSON.stringify(payload)]],
  colWidths: [20, 80]
});

const buildScheduleRows = (lang: Settings["language"], intervalsByDay: Record<number, Interval[]>, timeFormat12h: boolean) => {
  const header = [
    t(lang, "options.data.excel.header.day"),
    t(lang, "schedule.list.start"),
    t(lang, "schedule.list.end"),
    t(lang, "schedule.list.mode"),
    t(lang, "schedule.list.state")
  ];
  const rows: Array<Array<string | number>> = [header];
  for (let day = 0; day < 7; day += 1) {
    const label = getDayLabel(day, lang);
    const intervals = intervalsByDay[day] ?? [];
    if (intervals.length === 0) {
      rows.push([label, t(lang, "options.data.pdf.none"), "", "", ""]);
      continue;
    }
    intervals.forEach((interval) => {
      const mode =
        interval.mode === "free"
          ? t(lang, "schedule.modal.mode_free")
          : t(lang, "schedule.modal.mode_blocked");
      const state = interval.enabled ? t(lang, "schedule.list.enabled") : t(lang, "schedule.list.disabled");
      rows.push([
        label,
        formatTimeString(interval.start, timeFormat12h),
        formatTimeString(interval.end, timeFormat12h),
        mode,
        state
      ]);
    });
  }
  return rows;
};

const buildListRows = (lang: Settings["language"], settings: Settings) => {
  const header = [t(lang, "options.data.excel.header.list_type"), t(lang, "options.data.excel.header.value")];
  const rows: Array<Array<string | number>> = [header];
  if (settings.blockedDomains.length === 0 && settings.whitelist.length === 0) {
    rows.push([t(lang, "options.data.pdf.none"), ""]);
    return rows;
  }
  settings.blockedDomains.forEach((domain) => {
    rows.push([t(lang, "dashboard.blocked.title"), domain]);
  });
  settings.whitelist.forEach((entry) => {
    rows.push([t(lang, "dashboard.whitelist.title"), entry]);
  });
  return rows;
};

const buildMetricsSummaryRows = (lang: Settings["language"], settings: Settings, metrics: Metrics) => {
  const items: KeyValueItem[] = [
    { label: t(lang, "options.data.pdf.metrics.total_attempts"), value: String(sumValues(metrics.attemptsByDay)) },
    { label: t(lang, "options.data.pdf.metrics.total_time"), value: formatMinutesLabel(lang, sumValues(metrics.timeByDay)) },
    { label: t(lang, "options.data.pdf.metrics.total_sessions"), value: String(sumValues(metrics.sessionsByDay)) },
    {
      label: t(lang, "options.data.pdf.metrics.last_attempt"),
      value: metrics.lastAttemptAt
        ? formatDateTime(lang, metrics.lastAttemptAt, settings.timeFormat12h)
        : t(lang, "options.data.pdf.none")
    }
  ];
  return buildKeyValueRows(items, lang);
};

const buildMetricsDailyRows = (lang: Settings["language"], metrics: Metrics) => {
  const header = [
    t(lang, "dashboard.metrics.table.date"),
    t(lang, "dashboard.metrics.attempts"),
    t(lang, "options.data.excel.header.time"),
    t(lang, "dashboard.metrics.sessions")
  ];
  const rows: Array<Array<string | number>> = [header];
  getRecentDays(METRICS_DAYS).forEach((dayKey) => {
    rows.push([
      formatDate(lang, new Date(dayKey).getTime()),
      metrics.attemptsByDay[dayKey] || 0,
      roundMinutes(metrics.timeByDay[dayKey] || 0),
      metrics.sessionsByDay[dayKey] || 0
    ]);
  });
  return rows;
};

const buildTopDomainRows = (lang: Settings["language"], metrics: Metrics) => {
  const header = [t(lang, "options.data.excel.header.domain"), t(lang, "options.data.excel.header.time")];
  const rows: Array<Array<string | number>> = [header];
  const domains = aggregateDomains(metrics);
  if (domains.length === 0) {
    rows.push([t(lang, "options.data.pdf.none"), ""]);
    return rows;
  }
  domains.forEach(([domain, seconds]) => {
    rows.push([domain, roundMinutes(seconds)]);
  });
  return rows;
};

export function buildSettingsSheets(settings: Settings, includeRaw = true, rawPayload?: unknown): SheetData[] {
  const lang = settings.language;
  const payload = rawPayload ?? { settings };
  const summaryItems: KeyValueItem[] = [
    {
      label: t(lang, "options.data.pdf.active_profile"),
      value:
        settings.activeProfile === "kid"
          ? t(lang, "options.family.profile.kid")
          : t(lang, "options.family.profile.adult")
    },
    { label: t(lang, "options.data.pdf.language"), value: languageLabels[lang] },
    {
      label: t(lang, "options.data.pdf.time_format"),
      value: settings.timeFormat12h
        ? t(lang, "options.data.pdf.time_format_12h")
        : t(lang, "options.data.pdf.time_format_24h")
    },
    { label: t(lang, "options.data.pdf.family_mode"), value: yesNo(lang, settings.familyModeEnabled) },
    { label: t(lang, "options.data.pdf.strict_mode"), value: yesNo(lang, settings.strictMode) },
    { label: t(lang, "options.data.pdf.block_permanent"), value: yesNo(lang, settings.blockEnabled) }
  ];

  const blocksItems: KeyValueItem[] = [
    { label: t(lang, "options.blocks.shorts"), value: yesNo(lang, settings.blockShorts) },
    { label: t(lang, "options.blocks.kids"), value: yesNo(lang, settings.blockKids) },
    { label: t(lang, "options.blocks.instagram_reels"), value: yesNo(lang, settings.blockInstagramReels) }
  ];

  const weeklyItems: KeyValueItem[] = [
    { label: t(lang, "options.data.pdf.weekly_enabled"), value: yesNo(lang, settings.weeklyUnblockEnabled) },
    {
      label: t(lang, "options.data.pdf.weekly_days"),
      value:
        settings.weeklyUnblockDays.length > 0
          ? settings.weeklyUnblockDays.map((day) => getDayLabel(day, lang)).join(", ")
          : t(lang, "options.data.pdf.none")
    },
    {
      label: t(lang, "options.data.pdf.weekly_duration"),
      value: `${settings.weeklyUnblockDurationMinutes} ${t(lang, "options.weekly_unblock.minutes")}`
    },
    {
      label: t(lang, "options.data.pdf.weekly_until"),
      value: settings.weeklyUnblockUntil
        ? formatDateTime(lang, settings.weeklyUnblockUntil, settings.timeFormat12h)
        : t(lang, "options.data.pdf.none")
    }
  ];

  return [
    ...(includeRaw ? [buildRawSheet(payload)] : []),
    {
      name: sheetName(1, t(lang, "options.data.pdf.section.summary")),
      rows: buildKeyValueRows(summaryItems, lang),
      colWidths: [30, 40]
    },
    {
      name: sheetName(2, t(lang, "options.data.pdf.section.blocks")),
      rows: buildKeyValueRows(blocksItems, lang),
      colWidths: [30, 40]
    },
    {
      name: sheetName(3, t(lang, "options.data.pdf.section.lists")),
      rows: buildListRows(lang, settings),
      colWidths: [18, 50]
    },
    {
      name: sheetName(4, t(lang, "options.data.pdf.section.schedule")),
      rows: buildScheduleRows(lang, settings.intervalsByDay, settings.timeFormat12h),
      colWidths: [10, 12, 12, 14, 12]
    },
    {
      name: sheetName(5, t(lang, "options.data.pdf.section.weekly")),
      rows: buildKeyValueRows(weeklyItems, lang),
      colWidths: [30, 40]
    }
  ];
}

export function buildBackupSheets(settings: Settings, metrics: Metrics, rawPayload?: unknown): SheetData[] {
  const lang = settings.language;
  const payload = rawPayload ?? {
    version: 1,
    createdAt: new Date().toISOString(),
    settings,
    metrics
  };
  return [
    buildRawSheet(payload),
    ...buildSettingsSheets(settings, false),
    {
      name: sheetName(6, t(lang, "options.data.pdf.section.metrics")),
      rows: buildMetricsSummaryRows(lang, settings, metrics),
      colWidths: [30, 40]
    },
    {
      name: sheetName(7, t(lang, "options.data.pdf.section.metrics_daily")),
      rows: buildMetricsDailyRows(lang, metrics),
      colWidths: [20, 12, 14, 12]
    },
    {
      name: sheetName(8, t(lang, "options.data.pdf.section.top_domains")),
      rows: buildTopDomainRows(lang, metrics),
      colWidths: [30, 16]
    }
  ];
}
