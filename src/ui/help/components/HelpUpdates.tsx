import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type HelpUpdatesProps = {
  language: Settings["language"];
};

export function HelpUpdates({ language }: HelpUpdatesProps) {
  return (
    <section className="help-updates">
      <div className="help-updates-header">
        <h3>{t(language, "help.new.title")}</h3>
        <p>{t(language, "help.new.desc")}</p>
      </div>
      <div className="help-updates-grid">
        <div className="help-update-card">
          <div className="help-update-title">{t(language, "help.new.theme.title")}</div>
          <div className="help-update-desc">{t(language, "help.new.theme.desc")}</div>
        </div>
        <div className="help-update-card">
          <div className="help-update-title">{t(language, "help.new.export.title")}</div>
          <div className="help-update-desc">{t(language, "help.new.export.desc")}</div>
        </div>
        <div className="help-update-card">
          <div className="help-update-title">{t(language, "help.new.focus.title")}</div>
          <div className="help-update-desc">{t(language, "help.new.focus.desc")}</div>
        </div>
      </div>
    </section>
  );
}
