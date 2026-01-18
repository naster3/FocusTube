import { getSettings } from "../infrastructure/storage";

let timeoutId: number | null = null;
let intervalId: number | null = null;
let lastUntil: number | null = null;

// Limpia timers activos para evitar duplicados.
function clearTimers() {
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}

// Ejecuta el callback al vencer el desbloqueo.
function runExpire(onExpire: () => void) {
  clearTimers();
  onExpire();
}

// Programa timeout exacto y fallback por intervalo.
function schedule(unblockUntil: number | null, onExpire: () => void) {
  clearTimers();
  lastUntil = unblockUntil ?? null;
  if (!unblockUntil) {
    return;
  }
  const delay = unblockUntil - Date.now();
  if (delay <= 0) {
    window.setTimeout(() => runExpire(onExpire), 0);
    return;
  }
  timeoutId = window.setTimeout(() => runExpire(onExpire), delay);
  intervalId = window.setInterval(() => {
    if (lastUntil && Date.now() >= lastUntil) {
      runExpire(onExpire);
    }
  }, 60000);
}

// Inicializa el watcher y reprograma cuando cambian settings.
export async function initUnblockExpiryWatcher(onExpire: () => void) {
  const settings = await getSettings();
  schedule(settings.unblockUntil ?? null, onExpire);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) {
      return;
    }
    const next = changes.settings.newValue?.unblockUntil ?? null;
    schedule(next, onExpire);
  });
}
