import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type FamilyPanelProps = {
  settings: Settings;
  language: Settings["language"];
  onToggleFamilyMode: (enabled: boolean) => void;
  onSelectProfile: (profileId: "adult" | "kid") => void;
};

export function FamilyPanel({ settings, language, onToggleFamilyMode, onSelectProfile }: FamilyPanelProps) {
  return (
    <section className="panel family-panel">
      <div className="family-header">
        <div>
          <h3>{t(language, "options.family.title")}</h3>
          <p className="option-desc">{t(language, "options.family.desc")}</p>
        </div>
        <label className="family-toggle">
          <input
            type="checkbox"
            checked={settings.familyModeEnabled}
            onChange={(event) => onToggleFamilyMode(event.target.checked)}
          />
          <span>{t(language, "options.family.enable")}</span>
        </label>
      </div>
      <div className="family-profiles">
        <span className="family-label">{t(language, "options.family.profile_label")}</span>
        <div className="family-options">
          <button
            type="button"
            className={`family-option ${settings.activeProfile === "adult" ? "active" : ""}`}
            onClick={() => onSelectProfile("adult")}
            disabled={!settings.familyModeEnabled}
          >
            {t(language, "options.family.profile.adult")}
          </button>
          <button
            type="button"
            className={`family-option ${settings.activeProfile === "kid" ? "active" : ""}`}
            onClick={() => onSelectProfile("kid")}
            disabled={!settings.familyModeEnabled}
          >
            {t(language, "options.family.profile.kid")}
          </button>
        </div>
        {!settings.familyModeEnabled ? <span className="family-hint">{t(language, "options.family.hint")}</span> : null}
      </div>
    </section>
  );
}
