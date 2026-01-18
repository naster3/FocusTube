import React, { useMemo, useState, useEffect } from "react";
import type { Interval, IntervalWeek, Language } from "../../../core/types";
import { t, tf } from "../../../core/i18n";
import { Segment, computeTotals, detectOverlaps, minutesToTime, normalizeIntervals, parseTimeToMinutes } from "./helpers";

// Orden visual Lunes a Domingo.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS_ES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ScheduleViewProps = {
  intervalsByDay: IntervalWeek;
  timeFormat12h: boolean;
  language: Language;
  onChange: (next: IntervalWeek) => void;
  onReset?: () => void;
};

// Orquestador de vista Dia/Semana y edicion de intervalos.
export function ScheduleView({ intervalsByDay, timeFormat12h, language, onChange, onReset }: ScheduleViewProps) {
  const [activeTab, setActiveTab] = useState<"day" | "week">("day");
  const [selectedDay, setSelectedDay] = useState<number>(() => new Date().getDay());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Interval | null>(null);

  // Intervalos del dia seleccionado.
  const intervals = intervalsByDay[selectedDay] || [];
  const overlaps = useMemo(() => detectOverlaps(intervals), [intervals]);
  const totals = useMemo(() => computeTotals(intervals), [intervals]);

  // Acciones CRUD de intervalos.
  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleEdit = (interval: Interval) => {
    setEditing(interval);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    onChange({
      ...intervalsByDay,
      [selectedDay]: intervals.filter((i) => i.id !== id)
    });
  };

  const handleToggle = (id: string) => {
    onChange({
      ...intervalsByDay,
      [selectedDay]: intervals.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i))
    });
  };

  const handleSave = (next: Interval) => {
    const list = intervalsByDay[selectedDay] || [];
    const exists = list.some((i) => i.id === next.id);
    const nextList = exists ? list.map((i) => (i.id === next.id ? next : i)) : [...list, next];
    onChange({ ...intervalsByDay, [selectedDay]: nextList });
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{t(language, "schedule.title")}</h3>
          <p className="text-sm text-slate-600">{t(language, "schedule.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === "day" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setActiveTab("day")}
          >
            {t(language, "schedule.tab.day")}
          </button>
          <button
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === "week" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setActiveTab("week")}
          >
            {t(language, "schedule.tab.week")}
          </button>
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {t(language, "schedule.overlaps")}
        </div>
      )}

      {activeTab === "day" ? (
        <>
          <DayTimelineBar intervals={intervals} timeFormat12h={timeFormat12h} language={language} />
          <div className="mt-3 text-sm text-slate-700">
            {tf(language, "schedule.blocked_free", {
              blocked: formatMinutes(totals.blockedMinutes),
              free: formatMinutes(totals.freeMinutes)
            })}
          </div>

          <div className="mt-6">
            <IntervalList
              intervals={intervals}
              language={language}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
            />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm text-white"
                onClick={handleAdd}
              >
                {t(language, "schedule.add_interval")}
              </button>
              {onReset && (
                <button className="rounded-md border px-4 py-2 text-sm" onClick={onReset}>
                  {t(language, "schedule.reset")}
                </button>
              )}
            </div>
          </div>
        </>
      ) : (
        <WeekTimelineBars
          intervalsByDay={intervalsByDay}
          selectedDay={selectedDay}
          timeFormat12h={timeFormat12h}
          language={language}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setActiveTab("day");
          }}
        />
      )}

      <AddEditIntervalModal
        open={modalOpen}
        interval={editing}
        language={language}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </section>
  );
}

function DayTimelineBar({
  intervals,
  timeFormat12h,
  language
}: {
  intervals: Interval[];
  timeFormat12h: boolean;
  language: Language;
}) {
  const segments = useMemo(() => normalizeIntervals(intervals), [intervals]);
  const [nowMin, setNowMin] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    }, 60000);
    return () => window.clearInterval(id);
  }, []);

  const nowLeft = (nowMin / 1440) * 100;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex justify-between text-[11px] text-slate-500 mb-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i}>{formatMinuteLabel(i * 120, timeFormat12h)}</span>
        ))}
      </div>

      <div className="relative">
        <div className="flex h-12 w-full overflow-hidden rounded-md border border-slate-200 bg-white">
          {segments.map((segment) => (
            <TimeBlockSegment
              key={segment.id}
              segment={segment}
              timeFormat12h={timeFormat12h}
              language={language}
            />
          ))}
        </div>

        <div
          className="absolute top-0 -translate-x-1/2 h-full border-l-2 border-rose-500"
          style={{ left: `${nowLeft}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-rose-500 px-2 py-0.5 text-[11px] text-white">
            {t(language, "schedule.now")}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekTimelineBars({
  intervalsByDay,
  selectedDay,
  timeFormat12h,
  language,
  onSelectDay
}: {
  intervalsByDay: IntervalWeek;
  selectedDay: number;
  timeFormat12h: boolean;
  language: Language;
  onSelectDay: (day: number) => void;
}) {
  return (
    <div className="grid gap-3">
      {DAY_ORDER.map((day, idx) => {
        const segments = normalizeIntervals(intervalsByDay[day] || []);
        const dayLabel = language === "es" ? DAY_LABELS_ES[idx] : DAY_LABELS_EN[idx];
        const isActive = day === selectedDay;
        return (
          <button
            key={day}
            className={`w-full rounded-md border px-3 py-2 text-left ${
              isActive ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white"
            }`}
            onClick={() => onSelectDay(day)}
          >
            <div className="flex items-center gap-3">
              <span className="w-10 text-sm font-semibold">{dayLabel}</span>
              <div className="flex h-6 w-full overflow-hidden rounded-md border border-slate-200 bg-white">
                {segments.map((segment) => (
                  <TimeBlockSegment
                    key={segment.id}
                    segment={segment}
                    compact
                    timeFormat12h={timeFormat12h}
                    language={language}
                  />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function TimeBlockSegment({
  segment,
  compact,
  timeFormat12h,
  language
}: {
  segment: Segment;
  compact?: boolean;
  timeFormat12h: boolean;
  language: Language;
}) {
  const width = ((segment.endMin - segment.startMin) / 1440) * 100;
  const start = formatMinuteLabel(segment.startMin, timeFormat12h);
  const end = formatMinuteLabel(segment.endMin, timeFormat12h);
  const modeLabel = segment.mode === "blocked" ? t(language, "schedule.blocked_label") : t(language, "schedule.free_label");
  const period = translatePeriodLabel(segment.periodLabel, language);

  const base =
    segment.mode === "blocked"
      ? "bg-rose-200 text-rose-900 border-rose-300"
      : "bg-emerald-100 text-emerald-900 border-emerald-300";

  return (
    <div
      className={`h-full border-r last:border-r-0 flex items-center justify-center ${base} ${
        compact ? "text-[10px]" : "text-xs"
      }`}
      style={{ width: `${width}%` }}
      title={`${modeLabel} ${start}-${end}`}
    >
      <span className="px-1 text-center leading-tight">
        {compact ? (segment.mode === "blocked" ? "B" : "L") : `${modeLabel} - ${period}`}
      </span>
    </div>
  );
}

function IntervalList({
  intervals,
  language,
  onEdit,
  onDelete,
  onToggle
}: {
  intervals: Interval[];
  language: Language;
  onEdit: (interval: Interval) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-5 gap-2 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
        <span>{t(language, "schedule.list.start")}</span>
        <span>{t(language, "schedule.list.end")}</span>
        <span>{t(language, "schedule.list.mode")}</span>
        <span>{t(language, "schedule.list.state")}</span>
        <span className="text-right">{t(language, "schedule.list.actions")}</span>
      </div>
      {intervals.length === 0 ? (
        <div className="px-4 py-4 text-sm text-slate-500">{t(language, "schedule.empty")}</div>
      ) : (
        intervals.map((interval) => (
          <div key={interval.id} className="grid grid-cols-5 gap-2 px-4 py-2 text-sm border-t border-slate-100">
            <span>{interval.start}</span>
            <span>{interval.end}</span>
            <span className="capitalize">{interval.mode}</span>
            <button
              className={`w-fit rounded px-2 py-1 text-xs ${
                interval.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
              }`}
              onClick={() => onToggle(interval.id)}
            >
              {interval.enabled ? t(language, "schedule.list.enabled") : t(language, "schedule.list.disabled")}
            </button>
            <div className="flex justify-end gap-2">
              <button className="text-slate-600 hover:text-slate-900" onClick={() => onEdit(interval)}>
                {t(language, "schedule.list.edit")}
              </button>
              <button className="text-rose-600 hover:text-rose-800" onClick={() => onDelete(interval.id)}>
                {t(language, "schedule.list.delete")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function AddEditIntervalModal({
  open,
  interval,
  language,
  onClose,
  onSave
}: {
  open: boolean;
  interval: Interval | null;
  language: Language;
  onClose: () => void;
  onSave: (next: Interval) => void;
}) {
  const [start, setStart] = useState<Interval["start"]>("08:00");
  const [end, setEnd] = useState<Interval["end"]>("10:00");
  const [mode, setMode] = useState<Interval["mode"]>("blocked");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (interval) {
      setStart(interval.start);
      setEnd(interval.end);
      setMode(interval.mode);
      setEnabled(interval.enabled);
    }
  }, [interval]);

  if (!open) return null;

  const validate = () => {
    if (start === end) {
      return t(language, "schedule.modal.error_same");
    }
    return "";
  };

  const handleSave = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    onSave({
      id: interval?.id ?? `id-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      start,
      end,
      mode,
      enabled
    });
  };

  const durationLabel = () => {
    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (startMin === endMin) {
      return "0m";
    }
    const total = endMin > startMin ? endMin - startMin : 1440 - startMin + endMin;
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-1">
          {interval ? t(language, "schedule.modal.edit") : t(language, "schedule.modal.add")}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          {tf(language, "schedule.modal.duration", { duration: durationLabel() })}
        </p>

        {error && (
          <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <label className="text-sm">
            {t(language, "schedule.modal.start")}
            <input
              type="time"
              className="mt-1 w-full rounded border px-3 py-2"
              value={start}
              onChange={(e) => setStart(e.target.value as Interval["start"])}
            />
          </label>
          <label className="text-sm">
            {t(language, "schedule.modal.end")}
            <input
              type="time"
              className="mt-1 w-full rounded border px-3 py-2"
              value={end}
              onChange={(e) => setEnd(e.target.value as Interval["end"])}
            />
          </label>
          <label className="text-sm">
            {t(language, "schedule.modal.mode")}
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as Interval["mode"])}
            >
              <option value="blocked">{t(language, "schedule.modal.mode_blocked")}</option>
              <option value="free">{t(language, "schedule.modal.mode_free")}</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t(language, "schedule.modal.enabled")}
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onClose}>
            {t(language, "schedule.modal.cancel")}
          </button>
          <button className="px-4 py-2 rounded bg-slate-900 text-white" onClick={handleSave}>
            {t(language, "schedule.modal.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function translatePeriodLabel(label: string, language: Language) {
  if (language === "es") {
    return label;
  }
  switch (label) {
    case "Madrugada":
      return "Early morning";
    case "Mañana":
    case "MaAñana":
      return "Morning";
    case "Mediodía":
    case "MediodA-a":
      return "Midday";
    case "Tarde":
      return "Afternoon";
    case "Noche":
      return "Night";
    default:
      return label;
  }
}

function formatMinuteLabel(totalMinutes: number, use12h: boolean) {
  if (!use12h) {
    return minutesToTime(totalMinutes);
  }
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  const period = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${String(mm).padStart(2, "0")} ${period}`;
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${m}m`;
}
