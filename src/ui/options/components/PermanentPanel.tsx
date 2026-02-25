import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type WeeklyStatusTone = "active" | "warn" | "muted";

type DayOption = { value: number; label: string };

type PermanentPanelProps = {
  settings: Settings;
  language: Settings["language"];
  dayOptions: DayOption[];
  weeklyStatusText: string;
  weeklyStatusTone: WeeklyStatusTone;
  canStartWeekly: boolean;
  onSaveSettings: (next: Settings) => void;
  onStartWeeklySession: () => void;
};

export function PermanentPanel({
  settings,
  language,
  dayOptions,
  weeklyStatusText,
  weeklyStatusTone,
  canStartWeekly,
  onSaveSettings,
  onStartWeeklySession
}: PermanentPanelProps) {
  return (
    <section className="panel permanent-panel" data-guide="permanent">
      <h3>{t(language, "options.permanent.title")}</h3>
      <div className="permanent-grid permanent-grid-top">
        <div className="option-stack" data-guide="permanent-main">
          <p className="option-desc">{t(language, "options.permanent.desc")}</p>
          <label className="option-toggle option-toggle-hero option-accent-red">
            <span className="option-icon" aria-hidden="true" />
            <input
              type="checkbox"
              checked={settings.blockEnabled}
              onChange={(event) => onSaveSettings({ ...settings, blockEnabled: event.target.checked })}
            />
            <span className="option-text">{t(language, "options.permanent.enable")}</span>
          </label>
        </div>
        <div className="option-stack" data-guide="weekly-session-toggle">
          <p className="option-desc">{t(language, "options.weekly_unblock.desc")}</p>
          <label className="option-toggle option-toggle-hero option-accent-blue">
            <span className="option-icon" aria-hidden="true" />
            <input
              type="checkbox"
              checked={settings.weeklyUnblockEnabled}
              onChange={(event) => onSaveSettings({ ...settings, weeklyUnblockEnabled: event.target.checked })}
            />
            <span className="option-text">{t(language, "options.weekly_unblock.enable")}</span>
          </label>
        </div>
      </div>
      <div className="divider" />
      <div className="permanent-grid permanent-grid-bottom">
        <div className="weekly-days" data-guide="weekly-session-days">
          <span>{t(language, "options.weekly_unblock.days")}</span>
          <div className="weekly-days-list">
            {dayOptions.map((day) => (
              <label key={day.value} className="weekly-day">
                <input
                  type="checkbox"
                  checked={settings.weeklyUnblockDays.includes(day.value)}
                  onChange={() => {
                    const set = new Set(settings.weeklyUnblockDays);
                    if (set.has(day.value)) {
                      set.delete(day.value);
                    } else {
                      set.add(day.value);
                    }
                    onSaveSettings({ ...settings, weeklyUnblockDays: Array.from(set).sort((a, b) => a - b) });
                  }}
                />
                <span className="weekly-day-label">{day.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="weekly-duration-stack" data-guide="weekly-session-config">
          <label className="option-row">
            <span>{t(language, "options.weekly_unblock.duration")}</span>
            <input
              type="number"
              min={1}
              step={1}
              value={settings.weeklyUnblockDurationMinutes}
              onChange={(event) => {
                const raw = Number(event.target.value);
                const next = Number.isFinite(raw) ? Math.max(1, Math.floor(raw)) : 1;
                onSaveSettings({ ...settings, weeklyUnblockDurationMinutes: next });
              }}
            />
            <span>{t(language, "options.weekly_unblock.minutes")}</span>
          </label>
          <div className={`weekly-status ${weeklyStatusTone}`}>
            <span className="weekly-status-label">{t(language, "options.weekly_unblock.status.title")}</span>
            <span className="weekly-status-value">{weeklyStatusText}</span>
          </div>
          <div className="weekly-actions">
            <button type="button" onClick={onStartWeeklySession} disabled={!settings.weeklyUnblockEnabled || !canStartWeekly}>
              {t(language, "options.weekly_unblock.action.start")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
