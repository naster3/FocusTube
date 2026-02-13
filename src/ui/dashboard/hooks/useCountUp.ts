import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, durationMs: number, enabled: boolean, triggerKey: number, startValue = 0) {
  const [value, setValue] = useState(enabled ? target : startValue);
  const valueRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setValue(target);
      valueRef.current = target;
      return () => undefined;
    }

    const from = triggerKey > 0 ? startValue : valueRef.current;
    const to = target;
    if (from === to) {
      return () => undefined;
    }

    setValue(from);
    valueRef.current = from;

    const start = performance.now();
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(progress);
      const next = from + (to - from) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, durationMs, enabled, triggerKey, startValue]);

  return value;
}
