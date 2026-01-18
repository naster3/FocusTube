// Pantalla de bloqueo y desbloqueo temporal.
import { getMetrics, getSettings, setSettings } from "../../shared/storage";
import { formatDateTime } from "../../shared/utils";

// Acumula tiempo de pantalla bloqueada.
function startBlockedTimer() {
  let lastTick = Date.now();
  const sendTick = (deltaSec: number) => {
    try {
      chrome.runtime.sendMessage({ type: "BLOCKED_PAGE_TICK", deltaSec }, () => undefined);
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

const messages = [
  "Respira, enfoca y vuelve con un objetivo claro.",
  "Un descanso consciente hoy es un logro manana.",
  "Tu atencion es limitada, tu progreso no.",
  "Cinco minutos de foco ganan a una hora sin rumbo."
];

const params = new URLSearchParams(window.location.search);
let blockedUrl = params.get("url") || "";

// Cuando blocked.html viene sin ?url=... (por ejemplo, redirecciones sin querystring),
// intentamos recuperar la ultima URL intentada desde el background.
async function resolveBlockedUrl(): Promise<string> {
  if (blockedUrl) {
    return blockedUrl;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      return "";
    }
    const res = await chrome.runtime.sendMessage({ type: "GET_LAST_ATTEMPT", tabId }) as { ok?: boolean; url?: string | null } | undefined;
    if (res?.ok && typeof res.url === "string") {
      blockedUrl = res.url;
      return blockedUrl;
    }
  } catch {
    // ignore
  }
  return "";
}

const messageEl = document.getElementById("message");
const attemptsEl = document.getElementById("attempts");
const lastAttemptEl = document.getElementById("last-attempt");
const blockedUrlEl = document.getElementById("blocked-url");
const unblockBtn = document.getElementById("unblock-btn") as HTMLButtonElement | null;
const closeBtn = document.getElementById("close-btn") as HTMLButtonElement | null;

// Mensaje motivacional aleatorio.
function pickMessage() {
  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
}

// Renderiza datos de intents y botones.
async function render() {
  const [settings, metrics] = await Promise.all([getSettings(), getMetrics()]);
  await resolveBlockedUrl();
  const todayKey = new Date().toISOString().slice(0, 10);
  const attempts = metrics.attemptsByDay[todayKey] || 0;

  if (messageEl) {
    messageEl.textContent = pickMessage();
  }
  if (attemptsEl) {
    attemptsEl.textContent = String(attempts);
  }
  if (lastAttemptEl) {
    lastAttemptEl.textContent = metrics.lastAttemptAt ? formatDateTime(metrics.lastAttemptAt) : "-";
  }
  if (blockedUrlEl) {
    blockedUrlEl.textContent = blockedUrl ? `URL: ${blockedUrl}` : "";
  }

  if (!unblockBtn) {
    return;
  }

  if (settings.strictMode) {
    unblockBtn.disabled = true;
    unblockBtn.textContent = "Modo estricto activo";
  } else {
    unblockBtn.disabled = false;
    unblockBtn.textContent = "Desbloquear 5 minutos";
    unblockBtn.onclick = async () => {
      await resolveBlockedUrl();
      const now = Date.now();
      await setSettings({ ...settings, unblockUntil: now + 5 * 60 * 1000 });
      if (blockedUrl) {
        window.location.href = blockedUrl;
      }
    };
  }
}

closeBtn?.addEventListener("click", () => {
  window.close();
});

render();
startBlockedTimer();
