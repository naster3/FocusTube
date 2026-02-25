import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type LanguagePanelProps = {
  language: Settings["language"];
  onSetLanguage: (language: Settings["language"]) => void;
};

export function LanguagePanel({ language, onSetLanguage }: LanguagePanelProps) {
  return (
    <section className="panel language-panel" data-guide="language">
      <h3>{t(language, "options.language.title")}</h3>
      <div className="language-picker" data-guide="language-picker">
        <span className="language-label">{t(language, "options.language.current")}</span>
        <label className="language-option">
          <input
            type="radio"
            name="language"
            value="en"
            checked={language === "en"}
            onChange={() => onSetLanguage("en")}
          />
          <span>English</span>
        </label>
        <label className="language-option">
          <input
            type="radio"
            name="language"
            value="es"
            checked={language === "es"}
            onChange={() => onSetLanguage("es")}
          />
          <span>Español</span>
        </label>
        <label className="language-option">
          <input
            type="radio"
            name="language"
            value="pt"
            checked={language === "pt"}
            onChange={() => onSetLanguage("pt")}
          />
          <span>Português</span>
        </label>
        <label className="language-option">
          <input
            type="radio"
            name="language"
            value="fr"
            checked={language === "fr"}
            onChange={() => onSetLanguage("fr")}
          />
          <span>Français</span>
        </label>
      </div>
    </section>
  );
}
