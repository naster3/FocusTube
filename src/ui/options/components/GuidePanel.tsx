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
          <h3>{t(language, "options.guide.title")}</h3>
          <p className="guide-sub">{t(language, "options.guide.subtitle")}</p>
        </div>
        <div className="guide-actions">
          <button onClick={onStartGuide} disabled={!guideReady || guideActive}>
            {t(language, "options.guide.start")}
          </button>
          {guideSeen ? (
            <button type="button" className="btn-ghost" onClick={onRestartGuide}>
              {t(language, "options.guide.restart")}
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={onDismissGuide}>
              {t(language, "options.guide.dismiss")}
            </button>
          )}
        </div>
      </div>
      <div className="guide-body">
        <ol className="guide-steps">
          <li>{t(language, "options.guide.step1")}</li>
          <li>{t(language, "options.guide.step2")}</li>
          <li>{t(language, "options.guide.step3")}</li>
        </ol>
      </div>
    </section>
  );
}
