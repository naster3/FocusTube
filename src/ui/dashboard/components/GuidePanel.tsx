import React from "react";
import { t } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type GuidePanelProps = {
  language: Settings["language"];
  guideSeen: boolean;
  guideActive: boolean;
  guideReady: boolean;
  onStartGuide: () => void;
  onRestartGuide: () => void;
  onDismissGuide: () => void;
};

export function GuidePanel({
  language,
  guideSeen,
  guideActive,
  guideReady,
  onStartGuide,
  onRestartGuide,
  onDismissGuide
}: GuidePanelProps) {
  if (guideSeen && !guideActive) {
    return null;
  }

  return (
    <section className="panel guide-panel">
      <div className="guide-header">
        <div>
          <h3>{t(language, "dashboard.guide.title")}</h3>
          <p className="guide-sub">{t(language, "dashboard.guide.subtitle")}</p>
        </div>
        <div className="guide-actions">
          <button onClick={onStartGuide} disabled={!guideReady || guideActive}>
            {t(language, "dashboard.guide.start")}
          </button>
          {guideSeen ? (
            <button type="button" className="btn-ghost" onClick={onRestartGuide}>
              {t(language, "dashboard.guide.restart")}
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={onDismissGuide}>
              {t(language, "dashboard.guide.dismiss")}
            </button>
          )}
        </div>
      </div>
      <ol className="guide-steps">
        <li>{t(language, "dashboard.guide.step1")}</li>
        <li>{t(language, "dashboard.guide.step2")}</li>
        <li>{t(language, "dashboard.guide.step3")}</li>
      </ol>
    </section>
  );
}
