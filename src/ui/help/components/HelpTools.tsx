import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type HelpToolsProps = {
  language: Settings["language"];
  query: string;
  queryValue: string;
  optionsHref: string;
  dashboardHref: string;
  onQueryChange: (value: string) => void;
  onClear: () => void;
};

export function HelpTools({
  language,
  query,
  queryValue,
  optionsHref,
  dashboardHref,
  onQueryChange,
  onClear
}: HelpToolsProps) {
  return (
    <section className="help-tools">
      <div className="help-search">
        <div className="help-search-title">{t(language, "help.search.title")}</div>
        <div className="help-search-row">
          <input
            type="text"
            placeholder={t(language, "help.search.placeholder")}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          <button type="button" className="btn-ghost" onClick={onClear} disabled={!queryValue}>
            {t(language, "help.search.clear")}
          </button>
        </div>
      </div>
      <div className="help-actions">
        <div>
          <div className="help-actions-title">{t(language, "help.actions.title")}</div>
          <p className="help-actions-desc">{t(language, "help.actions.desc")}</p>
        </div>
        <div className="help-actions-row">
          <a className="help-action" href={optionsHref}>
            {t(language, "help.action.settings")}
          </a>
          <a className="help-action" href={dashboardHref}>
            {t(language, "help.action.dashboard")}
          </a>
        </div>
      </div>
    </section>
  );
}
