import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type ThemePanelProps = {
  language: Settings["language"];
  theme: Settings["theme"];
  onSetTheme: (theme: Settings["theme"]) => void;
};

export function ThemePanel({ language, theme, onSetTheme }: ThemePanelProps) {
  return (
    <section className="panel theme-panel">
      <h3>{t(language, "options.theme.title")}</h3>
      <p className="option-desc">{t(language, "options.theme.desc")}</p>
      <div className="theme-picker">
        <button
          type="button"
          className={`theme-option ${theme === "light" ? "active" : ""}`}
          onClick={() => onSetTheme("light")}
          aria-pressed={theme === "light"}
        >
          <span className="theme-swatch theme-swatch-light" aria-hidden="true" />
          <span>{t(language, "options.theme.light")}</span>
        </button>
        <button
          type="button"
          className={`theme-option ${theme === "system" ? "active" : ""}`}
          onClick={() => onSetTheme("system")}
          aria-pressed={theme === "system"}
        >
          <span className="theme-swatch theme-swatch-system" aria-hidden="true" />
          <span>{t(language, "options.theme.system")}</span>
        </button>
        <button
          type="button"
          className={`theme-option ${theme === "dark" ? "active" : ""}`}
          onClick={() => onSetTheme("dark")}
          aria-pressed={theme === "dark"}
        >
          <span className="theme-swatch theme-swatch-dark" aria-hidden="true" />
          <span>{t(language, "options.theme.dark")}</span>
        </button>
      </div>
    </section>
  );
}
