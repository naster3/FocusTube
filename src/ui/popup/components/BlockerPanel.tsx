import React from "react";
import type { Language } from "../../../domain/settings/types";
import { BlockerActions } from "./BlockerActions";
import { BlockerDebugSection } from "./BlockerDebugSection";
import { BlockerScheduleCard } from "./BlockerScheduleCard";
import { BlockerStatusCard } from "./BlockerStatusCard";

type BlockerPanelProps = {
  lang: Language;
  statusLabel: string;
  attemptsToday: number;
  scheduleLabel: string;
  scheduleCountdown: string;
  scheduleBlocked: boolean;
  nextBlockDuration: string | null;
  browserTimeText: string;
  tzOffsetMin: number;
  nextChangeText: string | null;
  blockEnabled: boolean;
  onToggle: () => void;
  onOpenOptions: () => void;
};

export function BlockerPanel({
  lang,
  statusLabel,
  attemptsToday,
  scheduleLabel,
  scheduleCountdown,
  scheduleBlocked,
  nextBlockDuration,
  browserTimeText,
  tzOffsetMin,
  nextChangeText,
  blockEnabled,
  onToggle,
  onOpenOptions
}: BlockerPanelProps) {
  return (
    <>
      <BlockerStatusCard lang={lang} statusLabel={statusLabel} attemptsToday={attemptsToday} />
      <BlockerScheduleCard
        lang={lang}
        scheduleLabel={scheduleLabel}
        scheduleCountdown={scheduleCountdown}
        scheduleBlocked={scheduleBlocked}
        nextBlockDuration={nextBlockDuration}
      />
      <BlockerDebugSection
        lang={lang}
        browserTimeText={browserTimeText}
        tzOffsetMin={tzOffsetMin}
        nextChangeText={nextChangeText}
      />
      <BlockerActions lang={lang} blockEnabled={blockEnabled} onToggle={onToggle} onOpenOptions={onOpenOptions} />
    </>
  );
}
