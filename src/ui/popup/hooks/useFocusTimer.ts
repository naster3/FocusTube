import { useCallback, useEffect, useMemo, useState } from "react";
import { onStorageChanged } from "../../../infrastructure/storage";

type FocusTimerMode = "focus" | "break";

type FocusTimerState = {
  mode: FocusTimerMode;
  running: boolean;
  endAt: number | null;
  remainingMs: number;
};

type FocusConfig = {
  focusMinutes: number;
  breakMinutes: number;
};

const FOCUS_TIMER_KEY = "focusTimer";
const FOCUS_CONFIG_KEY = "focusTimerConfig";

const clampMinutes = (value: unknown, fallback: number, max = 180) => {
  const num = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(1, Math.round(num)));
};

const normalizeFocusConfig = (input: unknown): FocusConfig => {
  const obj = typeof input === "object" && input ? (input as Partial<FocusConfig>) : {};
  return {
    focusMinutes: clampMinutes(obj.focusMinutes, 25, 180),
    breakMinutes: clampMinutes(obj.breakMinutes, 5, 60)
  };
};

const resolveFocusState = (
  input: FocusTimerState | null,
  nowTs: number,
  focusMsValue: number,
  breakMsValue: number
): FocusTimerState => {
  if (!input) {
    return { mode: "focus", running: false, endAt: null, remainingMs: focusMsValue };
  }
  const mode = input.mode === "break" ? "break" : "focus";
  const running = Boolean(input.running);
  const baseRemaining =
    Number.isFinite(input.remainingMs) && input.remainingMs > 0
      ? Math.max(0, input.remainingMs)
      : mode === "focus"
        ? focusMsValue
        : breakMsValue;
  const endAt = typeof input.endAt === "number" && Number.isFinite(input.endAt) ? input.endAt : null;

  if (!running || !endAt) {
    return {
      mode,
      running: false,
      endAt: null,
      remainingMs: baseRemaining || (mode === "focus" ? focusMsValue : breakMsValue)
    };
  }

  if (endAt > nowTs) {
    return {
      mode,
      running: true,
      endAt,
      remainingMs: Math.max(0, endAt - nowTs)
    };
  }

  let elapsed = nowTs - endAt;
  let nextMode: FocusTimerMode = mode === "focus" ? "break" : "focus";
  let nextDuration = nextMode === "focus" ? focusMsValue : breakMsValue;
  while (elapsed >= nextDuration) {
    elapsed -= nextDuration;
    nextMode = nextMode === "focus" ? "break" : "focus";
    nextDuration = nextMode === "focus" ? focusMsValue : breakMsValue;
  }
  const remaining = Math.max(0, nextDuration - elapsed);
  return {
    mode: nextMode,
    running: true,
    endAt: nowTs + remaining,
    remainingMs: remaining
  };
};

async function readFocusTimer(): Promise<FocusTimerState | null> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(FOCUS_TIMER_KEY);
      return (stored?.[FOCUS_TIMER_KEY] as FocusTimerState | undefined) ?? null;
    } catch {
      return null;
    }
  }
  try {
    const raw = window.localStorage.getItem(FOCUS_TIMER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FocusTimerState;
  } catch {
    return null;
  }
}

async function writeFocusTimer(state: FocusTimerState) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [FOCUS_TIMER_KEY]: state });
    } catch {
      // ignore
    }
    return;
  }
  try {
    window.localStorage.setItem(FOCUS_TIMER_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

async function readFocusConfig(): Promise<FocusConfig | null> {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get(FOCUS_CONFIG_KEY);
      return (stored?.[FOCUS_CONFIG_KEY] as FocusConfig | undefined) ?? null;
    } catch {
      return null;
    }
  }
  try {
    const raw = window.localStorage.getItem(FOCUS_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FocusConfig;
  } catch {
    return null;
  }
}

async function writeFocusConfig(config: FocusConfig) {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ [FOCUS_CONFIG_KEY]: config });
    } catch {
      // ignore
    }
    return;
  }
  try {
    window.localStorage.setItem(FOCUS_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function useFocusTimer(now: number) {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const focusMs = useMemo(() => focusMinutes * 60 * 1000, [focusMinutes]);
  const breakMs = useMemo(() => breakMinutes * 60 * 1000, [breakMinutes]);

  const [mode, setMode] = useState<FocusTimerMode>("focus");
  const [running, setRunning] = useState(false);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(focusMs);

  const applyState = useCallback((next: FocusTimerState, persist = true) => {
    setMode(next.mode);
    setRunning(next.running);
    setEndAt(next.endAt);
    setRemainingMs(next.remainingMs);
    if (persist) {
      void writeFocusTimer(next);
    }
  }, []);

  const applyConfig = useCallback((next: FocusConfig, persist = true) => {
    setFocusMinutes(next.focusMinutes);
    setBreakMinutes(next.breakMinutes);
    if (!running) {
      const nextTotal = mode === "focus" ? next.focusMinutes * 60 * 1000 : next.breakMinutes * 60 * 1000;
      setRemainingMs(nextTotal);
    }
    if (persist) {
      void writeFocusConfig(next);
    }
  }, [mode, running]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [storedConfig, storedTimer] = await Promise.all([readFocusConfig(), readFocusTimer()]);
      if (cancelled) return;
      const config = normalizeFocusConfig(storedConfig);
      applyConfig(config, false);
      const next = resolveFocusState(storedTimer, Date.now(), config.focusMinutes * 60 * 1000, config.breakMinutes * 60 * 1000);
      applyState(next, false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!running || !endAt) return;
    if (endAt > now) return;
    const next = resolveFocusState({ mode, running, endAt, remainingMs }, now, focusMs, breakMs);
    applyState(next);
  }, [running, endAt, now, mode, remainingMs, focusMs, breakMs, applyState]);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") {
        return;
      }
      if (changes[FOCUS_CONFIG_KEY]?.newValue) {
        const config = normalizeFocusConfig(changes[FOCUS_CONFIG_KEY].newValue);
        applyConfig(config, false);
      }
      if (changes[FOCUS_TIMER_KEY]?.newValue) {
        const next = resolveFocusState(changes[FOCUS_TIMER_KEY].newValue, Date.now(), focusMs, breakMs);
        applyState(next, false);
      }
    };
    return onStorageChanged(listener);
  }, [applyConfig, applyState, focusMs, breakMs]);

  const start = () => {
    if (running) return;
    const baseRemaining = (running && endAt) ? Math.max(0, endAt - Date.now()) : remainingMs;
    const nextRemaining = baseRemaining > 0 ? baseRemaining : (mode === "focus" ? focusMs : breakMs);
    applyState({
      mode,
      running: true,
      endAt: Date.now() + nextRemaining,
      remainingMs: nextRemaining
    });
  };

  const pause = () => {
    if (!running) return;
    const nextRemaining = endAt ? Math.max(0, endAt - Date.now()) : remainingMs;
    applyState({
      mode,
      running: false,
      endAt: null,
      remainingMs: nextRemaining
    });
  };

  const reset = () => {
    applyState({
      mode: "focus",
      running: false,
      endAt: null,
      remainingMs: focusMs
    });
  };

  const updateFocusMinutes = (value: string) => {
    const next = clampMinutes(value, focusMinutes, 180);
    applyConfig({ focusMinutes: next, breakMinutes });
  };

  const updateBreakMinutes = (value: string) => {
    const next = clampMinutes(value, breakMinutes, 60);
    applyConfig({ focusMinutes, breakMinutes: next });
  };

  const remaining = running && endAt ? Math.max(0, endAt - now) : remainingMs;

  return {
    mode,
    running,
    remainingMs: remaining,
    focusMinutes,
    breakMinutes,
    start,
    pause,
    reset,
    updateFocusMinutes,
    updateBreakMinutes
  };
}
