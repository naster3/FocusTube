import { isValidOutgoingMessage } from "../../../shared/messages";

// Acumula tiempo de pantalla bloqueada.
export function startBlockedTimer() {
  let lastTick = Date.now();
  const sendTick = (deltaSec: number) => {
    try {
      const message = { type: "BLOCKED_PAGE_TICK", deltaSec };
      if (!isValidOutgoingMessage(message, "blocked")) {
        return;
      }
      chrome.runtime.sendMessage(message, () => undefined);
    } catch {
      // Ignore if extension context is invalidated.
    }
  };

  window.setInterval(() => {
    if (document.visibilityState !== "visible") {
      lastTick = Date.now();
      return;
    }
    const now = Date.now();
    const deltaSec = Math.floor((now - lastTick) / 1000);
    if (deltaSec > 0) {
      sendTick(deltaSec);
      lastTick = now;
    }
  }, 10000);

  document.addEventListener("visibilitychange", () => {
    lastTick = Date.now();
  });
}
