import React from "react";
import { t, tf } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type GuideStep = {
  id: string;
  title: string;
  desc: string;
};

type GuidePanelProps = {
  language: Settings["language"];
  guideSeen: boolean;
  guideActive: boolean;
  guideReady: boolean;
  guideStepIndex: number;
  totalGuideSteps: number;
  guideSteps: GuideStep[];
  onStartGuide: () => void;
  onStepSelect: (index: number) => void;
  onRestartGuide: () => void;
  onDismissGuide: () => void;
};

export function GuidePanel({
  language,
  guideSeen,
  guideActive,
  guideReady,
  guideStepIndex,
  totalGuideSteps,
  guideSteps,
  onStartGuide,
  onStepSelect,
  onRestartGuide,
  onDismissGuide
}: GuidePanelProps) {
  if (guideSeen && !guideActive) {
    return null;
  }

  return (
    <section className="panel guide-panel">
      <div className="guide-overview">
        <div className="guide-progress">
          {tf(language, "dashboard.guide.progress", {
            current: String(Math.min(guideStepIndex + 1, totalGuideSteps || 1)),
            total: String(Math.max(totalGuideSteps, 1))
          })}
        </div>
        <div className="guide-progress-track" aria-hidden="true">
          <span
            className="guide-progress-value"
            style={{ width: `${(Math.min(guideStepIndex + 1, totalGuideSteps || 1) / Math.max(totalGuideSteps, 1)) * 100}%` }}
          />
        </div>
      </div>
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
        {guideSteps.map((step, index) => (
          <li key={step.id} className={guideActive && guideStepIndex === index ? "is-current" : ""}>
            <button type="button" className="guide-step-btn" onClick={() => onStepSelect(index)}>
              <span className="guide-step-title">{step.title}</span>
              <span className="guide-step-desc">{step.desc}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
