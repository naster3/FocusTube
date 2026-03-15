import React, { useEffect, useState } from "react";
import type { Language } from "../../../domain/settings/types";
import { formatDuration } from "../../../domain/schedule/timeline";
import { t, tf } from "../../../shared/i18n";

type FocusTimerCardProps = {
  lang: Language;
  focusMinutes: number;
  breakMinutes: number;
  mode: "focus" | "break";
  running: boolean;
  remainingMs: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onFocusMinutesChange: (value: string) => void;
  onBreakMinutesChange: (value: string) => void;
};

export function FocusTimerCard({
  lang,
  focusMinutes,
  breakMinutes,
  mode,
  running,
  remainingMs,
  onStart,
  onPause,
  onReset,
  onFocusMinutesChange,
  onBreakMinutesChange,
}: FocusTimerCardProps) {
  const [phaseBurst, setPhaseBurst] = useState(false);
  const focusLabel = mode === "focus" ? t(lang, "popup.focus.focus") : t(lang, "popup.focus.break");
  const totalMs = (mode === "focus" ? focusMinutes : breakMinutes) * 60 * 1000;
  const progress = totalMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / totalMs)) : 0;
  const progressDeg = `${Math.round(progress * 360)}deg`;
  const modeSummary =
    mode === "focus"
      ? tf(lang, "popup.focus.duration_focus", { minutes: String(focusMinutes) })
      : tf(lang, "popup.focus.duration_break", { minutes: String(breakMinutes) });
  const actionLabel = running ? t(lang, "popup.focus.pause") : t(lang, "popup.focus.start");
  const focusPresets = [25, 45, 60];
  const breakPresets = [5, 10, 15];

  useEffect(() => {
    setPhaseBurst(true);
    const id = window.setTimeout(() => setPhaseBurst(false), 520);
    return () => window.clearTimeout(id);
  }, [mode]);

  return (
    <div className={`card focus-card ${phaseBurst ? "phase-burst" : ""}`}>
      <div className="focus-header">
        <div>
          <div className="focus-title">{focusLabel}</div>
          <div className="focus-sub">
            {tf(lang, "popup.focus.duration_focus", { minutes: String(focusMinutes) })}
            {" / "}
            {tf(lang, "popup.focus.duration_break", { minutes: String(breakMinutes) })}
          </div>
        </div>
        <span className={`focus-chip ${mode}`}>{focusLabel}</span>
      </div>

      <div className={`focus-hero ${mode}`}>
        <div className="focus-progress-shell" style={{ ["--focus-progress" as string]: progressDeg }}>
          <div className="focus-progress-core">
            <div className="focus-progress-label">{modeSummary}</div>
            <div className="focus-timer">{formatDuration(remainingMs)}</div>
            <div className="focus-progress-meta">{Math.round(progress * 100)}%</div>
          </div>
        </div>
        <div className="focus-stats">
          <div className="focus-stat">
            <span>{t(lang, "popup.focus.label_focus")}</span>
            <strong>{focusMinutes}m</strong>
          </div>
          <div className="focus-stat">
            <span>{t(lang, "popup.focus.label_break")}</span>
            <strong>{breakMinutes}m</strong>
          </div>
        </div>
      </div>

      <div className="focus-config">
        <label className="focus-field">
          <span>{t(lang, "popup.focus.label_focus")}</span>
          <input
            type="number"
            min={1}
            max={180}
            value={focusMinutes}
            onChange={(event) => onFocusMinutesChange(event.target.value)}
          />
        </label>
        <label className="focus-field">
          <span>{t(lang, "popup.focus.label_break")}</span>
          <input
            type="number"
            min={1}
            max={60}
            value={breakMinutes}
            onChange={(event) => onBreakMinutesChange(event.target.value)}
          />
        </label>
      </div>
      <div className="focus-presets">
        <div className="focus-preset-group">
          {focusPresets.map((value) => (
            <button key={value} type="button" className="focus-preset" onClick={() => onFocusMinutesChange(String(value))}>
              {value}m
            </button>
          ))}
        </div>
        <div className="focus-preset-group">
          {breakPresets.map((value) => (
            <button key={value} type="button" className="focus-preset ghost" onClick={() => onBreakMinutesChange(String(value))}>
              {value}m
            </button>
          ))}
        </div>
      </div>
      <div className="focus-actions">
        <button className="focus-btn primary" onClick={running ? onPause : onStart}>
          {actionLabel}
        </button>
        <button className="focus-btn ghost" onClick={onReset}>
          {t(lang, "popup.focus.reset")}
        </button>
      </div>
    </div>
  );
}
