import React from "react";
import type { Language } from "../../../domain/settings/types";
import { t } from "../../../shared/i18n";

type BlockerScheduleCardProps = {
  lang: Language;
  scheduleLabel: string;
  scheduleCountdown: string;
  scheduleBlocked: boolean;
  nextBlockDuration: string | null;
};

export function BlockerScheduleCard({
  lang,
  scheduleLabel,
  scheduleCountdown,
  scheduleBlocked,
  nextBlockDuration
}: BlockerScheduleCardProps) {
  return (
    <div className="card">
      <div className="row">
        <span>{t(lang, "popup.schedule_status")}</span>
        <strong>{scheduleLabel}</strong>
      </div>
      <div className="row">
        <span>{scheduleBlocked ? t(lang, "popup.time_remaining") : t(lang, "popup.time_left")}</span>
        <strong>{scheduleCountdown}</strong>
      </div>
      {!scheduleBlocked && nextBlockDuration ? (
        <div className="row">
          <span>{t(lang, "popup.next_block")}</span>
          <strong>{nextBlockDuration}</strong>
        </div>
      ) : null}
    </div>
  );
}
