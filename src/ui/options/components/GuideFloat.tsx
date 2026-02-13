import React from "react";
import { t, tf } from "../../../shared/i18n";
import type { Settings } from "../../../domain/settings/types";

type GuideStep = {
  title: string;
  desc: string;
};

type GuideFloatProps = {
  language: Settings["language"];
  guideActive: boolean;
  guideStep: GuideStep | null;
  guideStepIndex: number;
  totalGuideSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  onSkip: () => void;
};

export function GuideFloat({
  language,
  guideActive,
  guideStep,
  guideStepIndex,
  totalGuideSteps,
  onPrev,
  onNext,
  onFinish,
  onSkip
}: GuideFloatProps) {
  if (!guideActive || !guideStep) {
    return null;
  }

  return (
    <div className="guide-float" role="dialog" aria-live="polite">
      <div className="guide-progress">
        {tf(language, "options.guide.progress", {
          current: String(guideStepIndex + 1),
          total: String(totalGuideSteps)
        })}
      </div>
      <div className="guide-title">{guideStep.title}</div>
      <div className="guide-text">{guideStep.desc}</div>
      <div className="guide-nav">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={guideStepIndex === 0}>
          {t(language, "options.guide.back")}
        </button>
        {guideStepIndex === totalGuideSteps - 1 ? (
          <button type="button" onClick={onFinish}>
            {t(language, "options.guide.finish")}
          </button>
        ) : (
          <button type="button" onClick={onNext}>
            {t(language, "options.guide.next")}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onSkip}>
          {t(language, "options.guide.skip")}
        </button>
      </div>
    </div>
  );
}
