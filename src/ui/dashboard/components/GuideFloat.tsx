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
  const floatRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!guideActive) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        if (guideStepIndex === totalGuideSteps - 1) {
          onFinish();
        } else {
          onNext();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guideActive, guideStepIndex, onFinish, onNext, onPrev, onSkip, totalGuideSteps]);

  React.useEffect(() => {
    if (!guideActive) {
      return;
    }
    window.requestAnimationFrame(() => {
      floatRef.current?.focus();
    });
  }, [guideActive, guideStepIndex]);

  if (!guideActive || !guideStep) {
    return null;
  }

  return (
    <div
      ref={floatRef}
      className="guide-float"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      tabIndex={-1}
    >
      <div className="guide-progress">
        {tf(language, "dashboard.guide.progress", {
          current: String(guideStepIndex + 1),
          total: String(totalGuideSteps)
        })}
      </div>
      <div className="guide-title" id={titleId}>{guideStep.title}</div>
      <div className="guide-text" id={descId}>{guideStep.desc}</div>
      <div className="guide-nav">
        <button type="button" className="btn-ghost" onClick={onPrev} disabled={guideStepIndex === 0}>
          {t(language, "dashboard.guide.back")}
        </button>
        {guideStepIndex === totalGuideSteps - 1 ? (
          <button type="button" onClick={onFinish}>
            {t(language, "dashboard.guide.finish")}
          </button>
        ) : (
          <button type="button" onClick={onNext}>
            {t(language, "dashboard.guide.next")}
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={onSkip}>
          {t(language, "dashboard.guide.skip")}
        </button>
      </div>
    </div>
  );
}
