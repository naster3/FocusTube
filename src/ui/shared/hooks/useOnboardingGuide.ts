import { useCallback, useEffect, useMemo, useState } from "react";

export type GuideStep = {
  id: string;
  target: string;
  title: string;
  desc: string;
};

type UseOnboardingGuideOptions = {
  steps: GuideStep[];
  storageKey: string;
};

export function useOnboardingGuide({ steps, storageKey }: UseOnboardingGuideOptions) {
  const [guideActive, setGuideActive] = useState(false);
  const [guideStepIndex, setGuideStepIndex] = useState(0);
  const [guideSeen, setGuideSeen] = useState(false);
  const [guideReady, setGuideReady] = useState(false);

  const totalGuideSteps = steps.length;
  const guideStep = steps[guideStepIndex] ?? null;

  const readGuideSeen = useCallback(async () => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const stored = await chrome.storage.local.get(storageKey);
        return Boolean(stored[storageKey]);
      }
    } catch {
      // ignore
    }
    try {
      return window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  }, [storageKey]);

  const writeGuideSeen = useCallback(async (value: boolean) => {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [storageKey]: value });
        return;
      }
    } catch {
      // ignore
    }
    try {
      window.localStorage.setItem(storageKey, value ? "1" : "0");
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const seen = await readGuideSeen();
      if (cancelled) {
        return;
      }
      setGuideSeen(seen);
      setGuideActive(!seen);
      setGuideReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [readGuideSeen]);

  useEffect(() => {
    if (!guideActive || !guideStep) {
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-guide="${guideStep.target}"]`);
    if (!el) {
      return;
    }
    el.classList.add("guide-highlight");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => {
      el.classList.remove("guide-highlight");
    };
  }, [guideActive, guideStep]);

  const startGuide = useCallback(() => {
    setGuideStepIndex(0);
    setGuideActive(true);
  }, []);

  const finishGuide = useCallback(async () => {
    setGuideActive(false);
    setGuideStepIndex(0);
    setGuideSeen(true);
    await writeGuideSeen(true);
  }, [writeGuideSeen]);

  const skipGuide = useCallback(async () => {
    await finishGuide();
  }, [finishGuide]);

  const restartGuide = useCallback(async () => {
    await writeGuideSeen(false);
    setGuideSeen(false);
    setGuideStepIndex(0);
    setGuideActive(true);
  }, [writeGuideSeen]);

  const dismissGuide = useCallback(async () => {
    setGuideActive(false);
    setGuideSeen(true);
    await writeGuideSeen(true);
  }, [writeGuideSeen]);

  const goPrev = useCallback(() => {
    setGuideStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const goNext = useCallback(() => {
    setGuideStepIndex((prev) => Math.min(totalGuideSteps - 1, prev + 1));
  }, [totalGuideSteps]);

  return useMemo(
    () => ({
      guideActive,
      guideStepIndex,
      guideSeen,
      guideReady,
      guideStep,
      totalGuideSteps,
      startGuide,
      finishGuide,
      skipGuide,
      restartGuide,
      dismissGuide,
      goPrev,
      goNext
    }),
    [
      guideActive,
      guideStepIndex,
      guideSeen,
      guideReady,
      guideStep,
      totalGuideSteps,
      startGuide,
      finishGuide,
      skipGuide,
      restartGuide,
      dismissGuide,
      goPrev,
      goNext
    ]
  );
}
