import React from "react";
import type { Language } from "../../../domain/settings/types";
import { t } from "../../../shared/i18n";

type BlockerDebugSectionProps = {
  lang: Language;
  browserTimeText: string;
  tzOffsetMin: number;
  nextChangeText: string | null;
};

export function BlockerDebugSection({ lang, browserTimeText, tzOffsetMin, nextChangeText }: BlockerDebugSectionProps) {
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.85 }}>{t(lang, "popup.debug.title")}</summary>
      <div className="row">
        <span>{t(lang, "popup.debug.browser_time")}</span>
        <strong style={{ fontSize: 12 }}>{browserTimeText}</strong>
      </div>
      <div className="row">
        <span>{t(lang, "popup.debug.tz_offset")}</span>
        <strong style={{ fontSize: 12 }}>{tzOffsetMin} min</strong>
      </div>
      <div className="row">
        <span>{t(lang, "popup.debug.next_change")}</span>
        <strong style={{ fontSize: 12 }}>{nextChangeText ?? "-"}</strong>
      </div>
    </details>
  );
}
