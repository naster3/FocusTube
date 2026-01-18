import React, { useMemo, useState, useEffect } from "react";
import type { Interval, IntervalWeek } from "../../../shared/types";
import { Segment, computeTotals, detectOverlaps, minutesToTime, normalizeIntervals, parseTimeToMinutes } from "./helpers";

// Orden visual Lunes a Domingo.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

type ScheduleViewProps = {
  intervalsByDay: IntervalWeek;
  timeFormat12h: boolean;
  onChange: (next: IntervalWeek) => void;
};

// Orquestador de vista Dia/Semana y edicion de intervalos.
export function ScheduleView({ intervalsByDay, timeFormat12h, onChange }: ScheduleViewProps) {
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
          <h3 className="text-lg font-semibold text-slate-900">Horarios</h3>
          <p className="text-sm text-slate-600">Define bloques y tiempos libres por dia.</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === "day" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setActiveTab("day")}
          >
            Dia
          </button>
          <button
            className={`rounded-md border px-3 py-1.5 text-sm ${
              activeTab === "week" ? "bg-slate-900 text-white" : "bg-white text-slate-700"
            }`}
            onClick={() => setActiveTab("week")}
          >
            Semana
          </button>
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Hay intervalos solapados
        </div>
      )}

      {activeTab === "day" ? (
        <>
          <DayTimelineBar intervals={intervals} timeFormat12h={timeFormat12h} />
          <div className="mt-3 text-sm text-slate-700">
            Bloqueado: {formatMinutes(totals.blockedMinutes)} / Libre: {formatMinutes(totals.freeMinutes)}
          </div>

          <div className="mt-6">
            <IntervalList intervals={intervals} onEdit={handleEdit} onDelete={handleDelete} onToggle={handleToggle} />
            <button
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-teal-600 px-4 py-2 text-sm text-white"
              onClick={handleAdd}
            >
              Agregar intervalo
            </button>
          </div>
        </>
      ) : (
        <WeekTimelineBars
          intervalsByDay={intervalsByDay}
          selectedDay={selectedDay}
          timeFormat12h={timeFormat12h}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setActiveTab("day");
          }}
        />
      )}

      <AddEditIntervalModal
        open={modalOpen}
        interval={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </section>
  );
}

function DayTimelineBar({ intervals, timeFormat12h }: { intervals: Interval[]; timeFormat12h: boolean }) {
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
            <TimeBlockSegment key={segment.id} segment={segment} timeFormat12h={timeFormat12h} />
          ))}
        </div>

        <div
          className="absolute top-0 -translate-x-1/2 h-full border-l-2 border-rose-500"
          style={{ left: `${nowLeft}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-rose-500 px-2 py-0.5 text-[11px] text-white">
            Now
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
  onSelectDay
}: {
  intervalsByDay: IntervalWeek;
  selectedDay: number;
  timeFormat12h: boolean;
  onSelectDay: (day: number) => void;
}) {
  return (
    <div className="grid gap-3">
      {DAY_ORDER.map((day, idx) => {
        const segments = normalizeIntervals(intervalsByDay[day] || []);
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
              <span className="w-10 text-sm font-semibold">{DAY_LABELS[idx]}</span>
              <div className="flex h-6 w-full overflow-hidden rounded-md border border-slate-200 bg-white">
                {segments.map((segment) => (
                  <TimeBlockSegment key={segment.id} segment={segment} compact timeFormat12h={timeFormat12h} />
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
  timeFormat12h
}: {
  segment: Segment;
  compact?: boolean;
  timeFormat12h: boolean;
}) {
  const width = ((segment.endMin - segment.startMin) / 1440) * 100;
  const start = formatMinuteLabel(segment.startMin, timeFormat12h);
  const end = formatMinuteLabel(segment.endMin, timeFormat12h);
  const modeLabel = segment.mode === "blocked" ? "BLOQUEADO" : "LIBRE";

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
        {compact ? (segment.mode === "blocked" ? "B" : "L") : `${modeLabel} - ${segment.periodLabel}`}
      </span>
    </div>
  );
}

function IntervalList({
  intervals,
  onEdit,
  onDelete,
  onToggle
}: {
  intervals: Interval[];
  onEdit: (interval: Interval) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-5 gap-2 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500">
        <span>Inicio</span>
        <span>Fin</span>
        <span>Modo</span>
        <span>Estado</span>
        <span className="text-right">Acciones</span>
      </div>
      {intervals.length === 0 ? (
        <div className="px-4 py-4 text-sm text-slate-500">Sin intervalos.</div>
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
              {interval.enabled ? "Enabled" : "Disabled"}
            </button>
            <div className="flex justify-end gap-2">
              <button className="text-slate-600 hover:text-slate-900" onClick={() => onEdit(interval)}>
                Editar
              </button>
              <button className="text-rose-600 hover:text-rose-800" onClick={() => onDelete(interval.id)}>
                Borrar
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
  onClose,
  onSave
}: {
  open: boolean;
  interval: Interval | null;
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
      return "Inicio y fin no pueden ser iguales.";
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
        <h2 className="text-lg font-semibold mb-1">{interval ? "Editar intervalo" : "Agregar intervalo"}</h2>
        <p className="mb-4 text-xs text-slate-500">Duracion estimada: {durationLabel()}</p>

        {error && (
          <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          <label className="text-sm">
            Inicio
            <input
              type="time"
              className="mt-1 w-full rounded border px-3 py-2"
              value={start}
              onChange={(e) => setStart(e.target.value as "HH:MM")}
            />
          </label>
          <label className="text-sm">
            Fin
            <input
              type="time"
              className="mt-1 w-full rounded border px-3 py-2"
              value={end}
              onChange={(e) => setEnd(e.target.value as "HH:MM")}
            />
          </label>
          <label className="text-sm">
            Modo
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as Interval["mode"])}
            >
              <option value="blocked">blocked</option>
              <option value="free">free</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="px-4 py-2 rounded border" onClick={onClose}>
            Cancelar
          </button>
          <button className="px-4 py-2 rounded bg-slate-900 text-white" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
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
