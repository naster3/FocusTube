import React from "react";
import type { Language } from "../../../domain/settings/types";
import { t } from "../../../shared/i18n";

type BlockerStatusCardProps = {
  lang: Language;
  statusLabel: string;
  attemptsToday: number;
};

export function BlockerStatusCard({ lang, statusLabel, attemptsToday }: BlockerStatusCardProps) {
  return (
    <div className="card">
      <div className="row">
        <span>{t(lang, "popup.tab_status")}</span>
        <strong>{statusLabel}</strong>
      </div>
      <div className="row">
        <span>{t(lang, "popup.attempts_today")}</span>
        <strong>{attemptsToday}</strong>
      </div>
    </div>
  );
}
