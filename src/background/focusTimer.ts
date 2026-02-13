import type { Language } from "../domain/settings/types";
import { t } from "../shared/i18n";

type FocusTimerState = {
  mode: "focus" | "break";
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
const ALARM_NAME = "focusTimerEnd";

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
  let nextMode: "focus" | "break" = mode === "focus" ? "break" : "focus";
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

async function getLanguage(): Promise<Language> {
  try {
    const stored = await chrome.storage.local.get("settings");
    const lang = (stored?.settings as { language?: Language } | undefined)?.language;
    return lang ?? "en";
  } catch {
    return "en";
  }
}

async function readFocusTimer(): Promise<FocusTimerState | null> {
  try {
    const stored = await chrome.storage.local.get(FOCUS_TIMER_KEY);
    return (stored?.[FOCUS_TIMER_KEY] as FocusTimerState | undefined) ?? null;
  } catch {
    return null;
  }
}

async function readFocusConfig(): Promise<FocusConfig> {
  try {
    const stored = await chrome.storage.local.get(FOCUS_CONFIG_KEY);
    return normalizeFocusConfig(stored?.[FOCUS_CONFIG_KEY]);
  } catch {
    return normalizeFocusConfig(null);
  }
}

async function writeFocusTimer(state: FocusTimerState) {
  try {
    await chrome.storage.local.set({ [FOCUS_TIMER_KEY]: state });
  } catch {
    // ignore
  }
}

function scheduleAlarm(state: FocusTimerState | null) {
  if (!state?.running || !state.endAt) {
    chrome.alarms.clear(ALARM_NAME);
    return;
  }
  const when = Math.max(Date.now() + 250, state.endAt);
  chrome.alarms.create(ALARM_NAME, { when });
}

async function notifyTransition(prevMode: "focus" | "break") {
  if (!chrome.notifications?.create) {
    return;
  }
  const lang = await getLanguage();
  const titleKey = prevMode === "focus" ? "focus.notify.focus_done.title" : "focus.notify.break_done.title";
  const bodyKey = prevMode === "focus" ? "focus.notify.focus_done.body" : "focus.notify.break_done.body";
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon-48.png",
    title: t(lang, titleKey),
    message: t(lang, bodyKey)
  });
}

async function handleAlarm() {
  const timer = await readFocusTimer();
  if (!timer?.running || !timer.endAt) {
    scheduleAlarm(timer);
    return;
  }
  const nowTs = Date.now();
  if (timer.endAt > nowTs) {
    scheduleAlarm(timer);
    return;
  }
  const config = await readFocusConfig();
  const next = resolveFocusState(timer, nowTs, config.focusMinutes * 60 * 1000, config.breakMinutes * 60 * 1000);
  await writeFocusTimer(next);
  scheduleAlarm(next);
  void notifyTransition(timer.mode);
}

export function registerFocusTimer() {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== ALARM_NAME) return;
    void handleAlarm();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[FOCUS_TIMER_KEY]) {
      scheduleAlarm(changes[FOCUS_TIMER_KEY].newValue as FocusTimerState | null);
    }
    if (changes[FOCUS_CONFIG_KEY]) {
      void (async () => {
        const timer = await readFocusTimer();
        scheduleAlarm(timer);
      })();
    }
  });

  void (async () => {
    const timer = await readFocusTimer();
    scheduleAlarm(timer);
  })();
}
