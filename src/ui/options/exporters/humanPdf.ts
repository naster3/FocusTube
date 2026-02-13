import type { Interval, Metrics, Settings } from "../../../domain/settings/types";
import { t, tf } from "../../../shared/i18n";
import { formatDate, formatDateTime, getDayLabel } from "../../../shared/i18n/dates";

type PdfPayload = {
  title: string;
  settings: Settings;
  metrics?: Metrics | null;
  language: Settings["language"];
};

type KeyValueItem = { label: string; value: string };

const LIST_LIMIT = 20;
const METRICS_DAYS = 30;

const languageLabels: Record<Settings["language"], string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
  fr: "FR"
};

const yesNo = (lang: Settings["language"], value: boolean) =>
  value ? t(lang, "options.data.pdf.value.yes") : t(lang, "options.data.pdf.value.no");

const roundMinutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10;

const formatMinutes = (lang: Settings["language"], seconds: number) =>
  `${roundMinutes(seconds)} ${t(lang, "options.weekly_unblock.minutes")}`;

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
    .slice(0, 6);
};

export function openHumanPdf({ title, settings, metrics, language }: PdfPayload) {
  const now = Date.now();
  const generatedAt = formatDateTime(language, now, settings.timeFormat12h);
  const profileLabel =
    settings.activeProfile === "kid"
      ? t(language, "options.family.profile.kid")
      : t(language, "options.family.profile.adult");
  const summaryItems: KeyValueItem[] = [
    { label: t(language, "options.data.pdf.active_profile"), value: profileLabel },
    { label: t(language, "options.data.pdf.language"), value: languageLabels[language] },
    {
      label: t(language, "options.data.pdf.time_format"),
      value: settings.timeFormat12h
        ? t(language, "options.data.pdf.time_format_12h")
        : t(language, "options.data.pdf.time_format_24h")
    },
    { label: t(language, "options.data.pdf.family_mode"), value: yesNo(language, settings.familyModeEnabled) },
    { label: t(language, "options.data.pdf.strict_mode"), value: yesNo(language, settings.strictMode) },
    { label: t(language, "options.data.pdf.block_permanent"), value: yesNo(language, settings.blockEnabled) }
  ];

  const blockItems: KeyValueItem[] = [
    { label: t(language, "options.blocks.shorts"), value: yesNo(language, settings.blockShorts) },
    { label: t(language, "options.blocks.kids"), value: yesNo(language, settings.blockKids) },
    {
      label: t(language, "options.blocks.instagram_reels"),
      value: yesNo(language, settings.blockInstagramReels)
    }
  ];

  const listItems: KeyValueItem[] = [
    { label: t(language, "options.data.pdf.blocked_domains_count"), value: String(settings.blockedDomains.length) },
    { label: t(language, "options.data.pdf.whitelist_count"), value: String(settings.whitelist.length) }
  ];

  const weeklyItems: KeyValueItem[] = [
    { label: t(language, "options.data.pdf.weekly_enabled"), value: yesNo(language, settings.weeklyUnblockEnabled) },
    {
      label: t(language, "options.data.pdf.weekly_days"),
      value:
        settings.weeklyUnblockDays.length > 0
          ? settings.weeklyUnblockDays.map((day) => getDayLabel(day, language)).join(", ")
          : t(language, "options.data.pdf.none")
    },
    {
      label: t(language, "options.data.pdf.weekly_duration"),
      value: `${settings.weeklyUnblockDurationMinutes} ${t(language, "options.weekly_unblock.minutes")}`
    },
    {
      label: t(language, "options.data.pdf.weekly_until"),
      value: settings.weeklyUnblockUntil
        ? formatDateTime(language, settings.weeklyUnblockUntil, settings.timeFormat12h)
        : t(language, "options.data.pdf.none")
    }
  ];

  const metricsTotals: KeyValueItem[] = [];
  let metricsSections: HTMLElement[] = [];
  if (metrics) {
    metricsTotals.push({ label: t(language, "options.data.pdf.metrics.total_attempts"), value: String(sumValues(metrics.attemptsByDay)) });
    metricsTotals.push({
      label: t(language, "options.data.pdf.metrics.total_time"),
      value: formatMinutes(language, sumValues(metrics.timeByDay))
    });
    metricsTotals.push({
      label: t(language, "options.data.pdf.metrics.total_sessions"),
      value: String(sumValues(metrics.sessionsByDay))
    });
    metricsTotals.push({
      label: t(language, "options.data.pdf.metrics.last_attempt"),
      value: metrics.lastAttemptAt
        ? formatDateTime(language, metrics.lastAttemptAt, settings.timeFormat12h)
        : t(language, "options.data.pdf.none")
    });

    const topDomains = aggregateDomains(metrics);
    const recentRows = getRecentDays(METRICS_DAYS).map((dayKey) => ({
      dayKey,
      attempts: metrics.attemptsByDay[dayKey] || 0,
      time: metrics.timeByDay[dayKey] || 0,
      sessions: metrics.sessionsByDay[dayKey] || 0
    }));
    const hasActivity = recentRows.some((row) => row.attempts > 0 || row.time > 0 || row.sessions > 0);
    metricsSections = [
      buildMetricsSection({
        lang: language,
        totals: metricsTotals,
        recentRows,
        hasActivity,
        topDomains
      })
    ];
  }

  const popup = window.open("", "_blank", "width=980,height=720");
  if (!popup) {
    return false;
  }

  const doc = popup.document;
  doc.open();
  doc.title = title;
  const metaCharset = doc.createElement("meta");
  metaCharset.setAttribute("charset", "utf-8");
  const style = doc.createElement("style");
  style.textContent = `
    body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
    h1 { margin: 0 0 6px 0; }
    h3 { margin: 0 0 8px 0; }
    h4 { margin: 16px 0 6px 0; }
    .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
    .section { margin-bottom: 20px; }
    .kv { width: 100%; border-collapse: collapse; margin-top: 6px; }
    .kv th, .kv td { border: 1px solid #e2e8f0; padding: 6px 8px; font-size: 12px; text-align: left; }
    .kv th { background: #f8fafc; width: 35%; }
    .list { margin: 6px 0 0 18px; padding: 0; font-size: 12px; }
    .list li { margin-bottom: 4px; }
    .list.compact { margin-left: 16px; }
    .muted { color: #94a3b8; font-size: 12px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .schedule-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    .schedule-day { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; }
    .schedule-title { font-weight: 700; margin-bottom: 4px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 12px; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
    .table th { background: #f8fafc; }
  `;
  doc.head.appendChild(metaCharset);
  doc.head.appendChild(style);

  const titleEl = buildText(doc, "h1", title);
  const metaEl = buildText(doc, "div", `${t(language, "options.data.pdf.generated_at")}: ${generatedAt}`, "meta");

  doc.body.appendChild(titleEl);
  doc.body.appendChild(metaEl);
  doc.body.appendChild(buildSection(doc, t(language, "options.data.pdf.section.summary"), buildKeyValueTable(doc, summaryItems)));
  doc.body.appendChild(buildSection(doc, t(language, "options.data.pdf.section.blocks"), buildKeyValueTable(doc, blockItems)));
  doc.body.appendChild(buildListsSection(doc, language, listItems, settings.blockedDomains, settings.whitelist));
  doc.body.appendChild(buildScheduleSection(doc, language, settings.intervalsByDay, settings.timeFormat12h));
  doc.body.appendChild(buildSection(doc, t(language, "options.data.pdf.section.weekly"), buildKeyValueTable(doc, weeklyItems)));

  metricsSections.forEach((section) => {
    doc.body.appendChild(section);
  });

  doc.close();
  popup.focus();
  popup.setTimeout(() => {
    popup.print();
  }, 0);

  return true;
}

type MetricsSectionParams = {
  lang: Settings["language"];
  totals: KeyValueItem[];
  recentRows: { dayKey: string; attempts: number; time: number; sessions: number }[];
  hasActivity: boolean;
  topDomains: Array<[string, number]>;
};

function buildText(doc: Document, tag: string, text: string, className?: string) {
  const el = doc.createElement(tag);
  if (className) {
    el.className = className;
  }
  el.textContent = text;
  return el;
}

function buildSection(doc: Document, title: string, content: HTMLElement) {
  const section = doc.createElement("section");
  section.className = "section";
  section.appendChild(buildText(doc, "h3", title));
  section.appendChild(content);
  return section;
}

function buildKeyValueTable(doc: Document, items: KeyValueItem[]) {
  const table = doc.createElement("table");
  table.className = "kv";
  const tbody = doc.createElement("tbody");
  items.forEach((item) => {
    const row = doc.createElement("tr");
    const th = doc.createElement("th");
    th.textContent = item.label;
    const td = doc.createElement("td");
    td.textContent = item.value;
    row.appendChild(th);
    row.appendChild(td);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
}

function buildList(doc: Document, lang: Settings["language"], items: string[], compact = false) {
  if (items.length === 0) {
    return buildText(doc, "p", t(lang, "options.data.pdf.none"), "muted");
  }
  const list = doc.createElement("ul");
  list.className = compact ? "list compact" : "list";
  const trimmed = items.slice(0, LIST_LIMIT);
  const remaining = items.length - trimmed.length;
  trimmed.forEach((item) => {
    const li = doc.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });
  if (remaining > 0) {
    const li = doc.createElement("li");
    li.className = "muted";
    li.textContent = tf(lang, "options.data.pdf.more", { count: String(remaining) });
    list.appendChild(li);
  }
  return list;
}

function buildIntervalsList(
  doc: Document,
  lang: Settings["language"],
  intervals: Interval[],
  timeFormat12h: boolean
) {
  if (intervals.length === 0) {
    return buildText(doc, "span", t(lang, "options.data.pdf.none"), "muted");
  }
  const list = doc.createElement("ul");
  list.className = "list compact";
  intervals.forEach((interval) => {
    const mode =
      interval.mode === "free"
        ? t(lang, "schedule.modal.mode_free")
        : t(lang, "schedule.modal.mode_blocked");
    const state = interval.enabled ? t(lang, "schedule.list.enabled") : t(lang, "schedule.list.disabled");
    const time = `${formatTimeString(interval.start, timeFormat12h)} - ${formatTimeString(interval.end, timeFormat12h)}`;
    const li = doc.createElement("li");
    li.textContent = `${time} - ${mode} - ${state}`;
    list.appendChild(li);
  });
  return list;
}

function buildListsSection(
  doc: Document,
  lang: Settings["language"],
  listItems: KeyValueItem[],
  blockedDomains: string[],
  whitelist: string[]
) {
  const section = doc.createElement("section");
  section.className = "section";
  section.appendChild(buildText(doc, "h3", t(lang, "options.data.pdf.section.lists")));
  section.appendChild(buildKeyValueTable(doc, listItems));
  const grid = doc.createElement("div");
  grid.className = "grid";
  const blockedWrap = doc.createElement("div");
  blockedWrap.appendChild(buildText(doc, "h4", t(lang, "dashboard.blocked.title")));
  blockedWrap.appendChild(buildList(doc, lang, blockedDomains));
  const whitelistWrap = doc.createElement("div");
  whitelistWrap.appendChild(buildText(doc, "h4", t(lang, "dashboard.whitelist.title")));
  whitelistWrap.appendChild(buildList(doc, lang, whitelist));
  grid.appendChild(blockedWrap);
  grid.appendChild(whitelistWrap);
  section.appendChild(grid);
  return section;
}

function buildScheduleSection(
  doc: Document,
  lang: Settings["language"],
  intervalsByDay: Record<number, Interval[]>,
  timeFormat12h: boolean
) {
  const section = doc.createElement("section");
  section.className = "section";
  section.appendChild(buildText(doc, "h3", t(lang, "options.data.pdf.section.schedule")));
  const grid = doc.createElement("div");
  grid.className = "schedule-grid";
  for (const day of [0, 1, 2, 3, 4, 5, 6]) {
    const label = getDayLabel(day, lang);
    const intervals = intervalsByDay[day] ?? [];
    const card = doc.createElement("div");
    card.className = "schedule-day";
    card.appendChild(buildText(doc, "div", label, "schedule-title"));
    card.appendChild(buildIntervalsList(doc, lang, intervals, timeFormat12h));
    grid.appendChild(card);
  }
  section.appendChild(grid);
  return section;
}

function buildMetricsSection({ lang, totals, recentRows, hasActivity, topDomains }: MetricsSectionParams) {
  const doc = document.implementation.createHTMLDocument("");
  const section = doc.createElement("section");
  section.className = "section";
  section.appendChild(buildText(doc, "h3", t(lang, "options.data.pdf.section.metrics")));
  section.appendChild(buildKeyValueTable(doc, totals));

  const daily = doc.createElement("div");
  daily.className = "subsection";
  daily.appendChild(buildText(doc, "h4", t(lang, "options.data.pdf.section.metrics_daily")));
  daily.appendChild(buildText(doc, "p", tf(lang, "options.data.pdf.metrics_window", { count: String(METRICS_DAYS) }), "muted"));
  daily.appendChild(hasActivity ? buildMetricsTable(doc, lang, recentRows) : buildText(doc, "p", t(lang, "options.data.pdf.none"), "muted"));
  section.appendChild(daily);

  const top = doc.createElement("div");
  top.className = "subsection";
  top.appendChild(buildText(doc, "h4", t(lang, "options.data.pdf.section.top_domains")));
  if (topDomains.length === 0) {
    top.appendChild(buildText(doc, "p", t(lang, "options.data.pdf.none"), "muted"));
  } else {
    const list = doc.createElement("ul");
    list.className = "list compact";
    topDomains.forEach(([domain, seconds]) => {
      const li = doc.createElement("li");
      li.textContent = `${domain} - ${formatMinutes(lang, seconds)}`;
      list.appendChild(li);
    });
    top.appendChild(list);
  }
  section.appendChild(top);

  return section;
}

function buildMetricsTable(
  doc: Document,
  lang: Settings["language"],
  rows: { dayKey: string; attempts: number; time: number; sessions: number }[]
) {
  const table = doc.createElement("table");
  table.className = "table";
  const thead = doc.createElement("thead");
  const headerRow = doc.createElement("tr");
  const headers = [
    t(lang, "dashboard.metrics.table.date"),
    t(lang, "dashboard.metrics.attempts"),
    `${t(lang, "dashboard.metrics.time")} (${t(lang, "options.weekly_unblock.minutes")})`,
    t(lang, "dashboard.metrics.sessions")
  ];
  headers.forEach((label) => {
    const th = doc.createElement("th");
    th.textContent = label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  const tbody = doc.createElement("tbody");
  rows.forEach((row) => {
    const tr = doc.createElement("tr");
    const cells = [
      formatDate(lang, new Date(row.dayKey).getTime()),
      String(row.attempts),
      String(roundMinutes(row.time)),
      String(row.sessions)
    ];
    cells.forEach((value) => {
      const td = doc.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}
