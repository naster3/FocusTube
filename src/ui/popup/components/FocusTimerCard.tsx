import React from "react";
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
  onBreakMinutesChange
}: FocusTimerCardProps) {
  const focusLabel = mode === "focus" ? t(lang, "popup.focus.focus") : t(lang, "popup.focus.break");

  return (
    <div className="card focus-card">
      <div className="focus-header">
        <div className="focus-sub">
          {tf(lang, "popup.focus.duration_focus", { minutes: String(focusMinutes) })}{" / "}
          {tf(lang, "popup.focus.duration_break", { minutes: String(breakMinutes) })}
        </div>
        <span className={`focus-chip ${mode}`}>{focusLabel}</span>
      </div>
      <div className="focus-timer">{formatDuration(remainingMs)}</div>
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
      <div className="focus-actions">
        <button className="focus-btn" onClick={onStart} disabled={running}>
          {t(lang, "popup.focus.start")}
        </button>
        <button className="focus-btn ghost" onClick={onPause} disabled={!running}>
          {t(lang, "popup.focus.pause")}
        </button>
        <button className="focus-btn ghost" onClick={onReset}>
          {t(lang, "popup.focus.reset")}
        </button>
      </div>
    </div>
  );
}
