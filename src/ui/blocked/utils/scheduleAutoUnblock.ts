import type { MessageResponse } from "../../../shared/messages";
import { isValidOutgoingMessage } from "../../../shared/messages";
import { navigateTo } from "./navigation";

type ScheduleAutoUnblockController = {
  start: () => void;
  checkOnce: () => Promise<void>;
  setEnabled: (value: boolean) => void;
};

type ScheduleAutoUnblockDeps = {
  resolveBlockedUrl: () => Promise<string>;
};

// Libera automaticamente cuando el horario deja de bloquear.
export function createScheduleAutoUnblockController({
  resolveBlockedUrl
}: ScheduleAutoUnblockDeps): ScheduleAutoUnblockController {
  let enabled = false;
  let intervalId: number | null = null;

  const checkOnce = async () => {
    if (!enabled) {
      return;
    }
    const url = await resolveBlockedUrl();
    if (!url) {
      return;
    }
    try {
      const message = { type: "GET_TIMELINE" };
      if (!isValidOutgoingMessage(message, "blocked")) {
        return;
      }
      const res = (await chrome.runtime.sendMessage(message)) as MessageResponse<"GET_TIMELINE"> | undefined;
      if (res?.ok && res.timeline.state === "free") {
        navigateTo(url);
      }
    } catch {
      // ignore
    }
  };

  const startInterval = () => {
    if (intervalId !== null) {
      return;
    }
    intervalId = window.setInterval(() => {
      void checkOnce();
    }, 15000);
  };

  const stopInterval = () => {
    if (intervalId === null) {
      return;
    }
    window.clearInterval(intervalId);
    intervalId = null;
  };

  const start = () => {
    if (enabled) {
      startInterval();
    }
  };

  return {
    start,
    checkOnce,
    setEnabled: (value: boolean) => {
      enabled = value;
      if (enabled) {
        startInterval();
      } else {
        stopInterval();
      }
    }
  };
}
