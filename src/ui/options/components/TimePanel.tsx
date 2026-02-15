import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type TimePanelProps = {
  settings: Settings;
  language: Settings["language"];
  onSaveSettings: (next: Settings) => void;
};

export function TimePanel({ settings, language, onSaveSettings }: TimePanelProps) {
  return (
    <section className="panel" data-guide="time">
      <h3>{t(language, "options.time.title")}</h3>
      <label data-guide="time-format-toggle">
        <input
          type="checkbox"
          checked={settings.timeFormat12h}
          onChange={(event) => onSaveSettings({ ...settings, timeFormat12h: event.target.checked })}
        />
        {t(language, "options.time.use12h")}
      </label>
    </section>
  );
}
