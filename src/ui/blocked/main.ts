// Pantalla de bloqueo y desbloqueo temporal.
import { getMetrics, getSettings, updateSettings } from "../../infrastructure/storage";
import { formatDateTime } from "../../shared/utils";
import { t, tf } from "../../shared/i18n";
import { canStartWeeklySession, getWeeklySessionDurationMs, getWeeklySessionWeekKey, isWeeklySessionActive } from "../../domain/weekly/weekly";
import { hostnameMatches } from "../../domain/blocking/url";

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

const messages = ["blocked.message.1", "blocked.message.2", "blocked.message.3", "blocked.message.4"] as const;

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
const blockedUrlLabelEl = document.getElementById("blocked-url-label");
const copyUrlBtn = document.getElementById("copy-url-btn") as HTMLButtonElement | null;
const unblockBtn = document.getElementById("unblock-btn") as HTMLButtonElement | null;
const closeBtn = document.getElementById("close-btn") as HTMLButtonElement | null;
const blockedTagEl = document.getElementById("blocked-tag");
const blockedTitleEl = document.getElementById("blocked-title");
const attemptsLabelEl = document.getElementById("attempts-label");
const lastAttemptLabelEl = document.getElementById("last-attempt-label");

let allowScheduleAutoUnblock = false;

function matchBlockedDomain(urlString: string, blockedDomains: string[]) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return blockedDomains.find((domain) => hostnameMatches(hostname, domain)) || null;
  } catch {
    return null;
  }
}

// Libera automaticamente cuando el horario deja de bloquear.
function startScheduleAutoUnblock() {
  const intervalMs = 15000;
  window.setInterval(async () => {
    if (!allowScheduleAutoUnblock) {
      return;
    }
    await resolveBlockedUrl();
    if (!blockedUrl) return;
    try {
      const res = await chrome.runtime.sendMessage({ type: "GET_TIMELINE" }) as { ok?: boolean; timeline?: { state?: string } } | undefined;
      if (res?.ok && res.timeline?.state === "free") {
        window.location.href = blockedUrl;
      }
    } catch {
      // ignore
    }
  }, intervalMs);
}

// Mensaje motivacional aleatorio.
function pickMessage(lang: "en" | "es") {
  const index = Math.floor(Math.random() * messages.length);
  return t(lang, messages[index]);
}

// Renderiza datos de intents y botones.
async function render() {
  const [settings, metrics] = await Promise.all([getSettings(), getMetrics()]);
  const lang = settings.language ?? "en";
  await resolveBlockedUrl();
  const todayKey = new Date().toISOString().slice(0, 10);
  const attempts = metrics.attemptsByDay[todayKey] || 0;

  if (messageEl) {
    messageEl.textContent = pickMessage(lang);
  }
  if (blockedTagEl) {
    blockedTagEl.textContent = t(lang, "blocked.tag");
  }
  if (blockedTitleEl) {
    blockedTitleEl.textContent = t(lang, "blocked.title");
  }
  if (attemptsLabelEl) {
    attemptsLabelEl.textContent = t(lang, "blocked.attempts_today");
  }
  if (lastAttemptLabelEl) {
    lastAttemptLabelEl.textContent = t(lang, "blocked.last_attempt");
  }
  if (blockedUrlLabelEl) {
    blockedUrlLabelEl.textContent = t(lang, "blocked.url_prefix");
  }
  if (attemptsEl) {
    attemptsEl.textContent = String(attempts);
  }
  if (lastAttemptEl) {
    lastAttemptEl.textContent = metrics.lastAttemptAt ? formatDateTime(metrics.lastAttemptAt) : "-";
  }
  if (blockedUrlEl) {
    blockedUrlEl.textContent = blockedUrl || "";
  }
  if (copyUrlBtn) {
    copyUrlBtn.textContent = t(lang, "blocked.copy");
    copyUrlBtn.disabled = !blockedUrl;
    copyUrlBtn.onclick = async () => {
      if (!blockedUrl) {
        return;
      }
      try {
        await navigator.clipboard.writeText(blockedUrl);
        copyUrlBtn.textContent = t(lang, "blocked.copied");
        window.setTimeout(() => {
          if (copyUrlBtn) {
            copyUrlBtn.textContent = t(lang, "blocked.copy");
          }
        }, 1500);
      } catch {
        // ignore
      }
    };
  }

  if (!unblockBtn) {
    return;
  }

  const matchedDomain = blockedUrl ? matchBlockedDomain(blockedUrl, settings.blockedDomains) : null;
  const tags = matchedDomain ? settings.blockedDomainTags?.[matchedDomain] ?? [] : [];
  const hasIntervals = tags.includes("intervalos");
  const hasWeekly = tags.includes("por_semana");
  allowScheduleAutoUnblock = hasIntervals;

  if (!tags.length) {
    unblockBtn.disabled = true;
    unblockBtn.textContent = t(lang, "blocked.missing_tag");
    return;
  }

  const now = Date.now();
  if (hasWeekly && !hasIntervals) {
    if (!settings.weeklyUnblockEnabled) {
      unblockBtn.disabled = true;
      unblockBtn.textContent = t(lang, "blocked.weekly.disabled");
      return;
    }
    const weeklyActive = isWeeklySessionActive(settings, now);
    const weekKey = getWeeklySessionWeekKey(now);
    const alreadyUsed = settings.weeklyUnblockLastWeek === weekKey;
    const allowedDays = settings.weeklyUnblockDays ?? [];
    const allowedToday = allowedDays.includes(new Date(now).getDay());
    const canStart = !weeklyActive && canStartWeeklySession(settings, now);
    const durationMs = getWeeklySessionDurationMs(settings);
    const durationMin = Math.max(1, Math.floor(durationMs / 60000));

    if (!canStart) {
      unblockBtn.disabled = true;
      unblockBtn.textContent = weeklyActive
        ? t(lang, "blocked.weekly.used")
        : alreadyUsed
          ? t(lang, "blocked.weekly.used")
          : allowedToday
            ? t(lang, "blocked.weekly.used")
            : t(lang, "blocked.weekly.unavailable_day");
      return;
    }

    unblockBtn.disabled = false;
    unblockBtn.textContent = tf(lang, "blocked.weekly.unblock", { minutes: String(durationMin) });
    unblockBtn.onclick = async () => {
      await resolveBlockedUrl();
      const start = Date.now();
      const until = start + durationMs;
      await updateSettings({
        weeklyUnblockUntil: until,
        weeklyUnblockLastWeek: getWeeklySessionWeekKey(start)
      });
      if (blockedUrl) {
        window.location.href = blockedUrl;
      }
    };
    return;
  }

  if (settings.strictMode) {
    unblockBtn.disabled = true;
    unblockBtn.textContent = t(lang, "blocked.strict_active");
  } else {
    unblockBtn.disabled = false;
    unblockBtn.textContent = t(lang, "blocked.unblock");
    unblockBtn.onclick = async () => {
      await resolveBlockedUrl();
      const start = Date.now();
      await updateSettings({ unblockUntil: start + 5 * 60 * 1000 });
      if (blockedUrl) {
        window.location.href = blockedUrl;
      }
    };
  }

  if (closeBtn) {
    closeBtn.textContent = t(lang, "blocked.close");
  }
}

async function closeBlockedTab() {
  try {
    window.close();
  } catch {
    // ignore
  }
  try {
    const currentTab = await chrome.tabs.getCurrent();
    const tabId = currentTab?.id;
    if (tabId) {
      await chrome.tabs.remove(tabId);
      return;
    }
  } catch {
    // ignore
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs?.[0]?.id;
    if (tabId) {
      await chrome.tabs.remove(tabId);
      return;
    }
  } catch {
    // ignore
  }
  try {
    await chrome.runtime.sendMessage({ type: "CLOSE_ACTIVE_TAB" });
  } catch {
    // ignore
  }
}

closeBtn?.addEventListener("click", () => {
  void closeBlockedTab();
});

render();
startBlockedTimer();
startScheduleAutoUnblock();

