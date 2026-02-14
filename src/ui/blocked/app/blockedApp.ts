// Pantalla de bloqueo y desbloqueo temporal.
import { getMetrics, getSettings, updateSettings } from "../../../infrastructure/storage";
import { formatDateTime } from "../../../shared/i18n/dates";
import { t, tf } from "../../../shared/i18n";
import { canStartWeeklySession, getWeeklySessionDayKey, getWeeklySessionDurationMs, isWeeklySessionActive } from "../../../domain/weekly/weekly";
import { evaluateBlock, reasonLabel } from "../../../domain/blocking/url";
import { parseTimeToMinutes } from "../../../domain/schedule/schedule";
import type { Settings } from "../../../domain/settings/types";
import { getBlockedElements } from "../utils/dom";
import { getInitialBlockedUrl, matchBlockedDomain, resolveBlockedAttempt } from "../utils/blockedUrl";
import { startBlockedTimer } from "../utils/timers";
import { pickMessage } from "../utils/messages";
import { createScheduleAutoUnblockController } from "../utils/scheduleAutoUnblock";
import { closeBlockedTab } from "../utils/close";

let initialized = false;

function isCarryoverScheduleBlock(now: Date, intervalsByDay: Settings["intervalsByDay"]) {
  const day = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const prevDay = (day + 6) % 7;
  const prevIntervals = intervalsByDay[prevDay] || [];
  return prevIntervals.some((interval) => {
    if (interval.enabled === false || interval.mode !== "blocked") {
      return false;
    }
    const start = parseTimeToMinutes(interval.start);
    const end = parseTimeToMinutes(interval.end);
    if (start === end || end > start) {
      return false;
    }
    return minutes < end;
  });
}

export function initBlockedPage() {
  if (initialized) {
    return;
  }
  initialized = true;

  let blockedUrl = getInitialBlockedUrl();
  let lastAttemptAtFallback: number | null = null;
  const elements = getBlockedElements();

  const scheduleAutoUnblock = createScheduleAutoUnblockController({
    resolveBlockedUrl: async () => {
      const resolved = await resolveBlockedAttempt(blockedUrl);
      blockedUrl = resolved.url;
      if (typeof resolved.at === "number") {
        lastAttemptAtFallback = resolved.at;
      }
      return blockedUrl;
    }
  });

  async function confirmAction(
    lang: Settings["language"],
    {
      title,
      description,
      confirmLabel
    }: { title: string; description: string; confirmLabel: string }
  ) {
    if (!elements.confirmModalEl || !elements.confirmTitleEl || !elements.confirmDescEl || !elements.confirmCancelBtn || !elements.confirmConfirmBtn) {
      return window.confirm(`${title}\n\n${description}`);
    }

    elements.confirmTitleEl.textContent = title;
    elements.confirmDescEl.textContent = description;
    elements.confirmConfirmBtn.textContent = confirmLabel;
    elements.confirmConfirmBtn.setAttribute("aria-label", confirmLabel);
    elements.confirmCancelBtn.textContent = t(lang, "blocked.confirm.cancel");
    elements.confirmCancelBtn.setAttribute("aria-label", t(lang, "blocked.confirm.cancel"));
    elements.confirmModalEl.setAttribute("data-open", "true");

    return await new Promise<boolean>((resolve) => {
      const cleanup = (value: boolean) => {
        elements.confirmModalEl?.removeAttribute("data-open");
        elements.confirmModalEl?.removeAttribute("aria-hidden");
        elements.confirmCancelBtn?.removeEventListener("click", onCancel);
        elements.confirmConfirmBtn?.removeEventListener("click", onConfirm);
        elements.confirmModalEl?.removeEventListener("click", onBackdrop);
        resolve(value);
      };

      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);
      const onBackdrop = (event: Event) => {
        if (event.target === elements.confirmModalEl) {
          cleanup(false);
        }
      };

      elements.confirmModalEl?.setAttribute("aria-hidden", "false");
      elements.confirmCancelBtn?.addEventListener("click", onCancel);
      elements.confirmConfirmBtn?.addEventListener("click", onConfirm);
      elements.confirmModalEl?.addEventListener("click", onBackdrop);
    });
  }

  // Renderiza datos de intents y botones.
  async function render() {
    const [settings, metrics] = await Promise.all([getSettings(), getMetrics()]);
    const lang = settings.language ?? "en";
    const resolved = await resolveBlockedAttempt(blockedUrl);
    blockedUrl = resolved.url;
    if (typeof resolved.at === "number") {
      lastAttemptAtFallback = resolved.at;
    }
    const todayKey = new Date().toISOString().slice(0, 10);
    const hasFallbackToday =
      typeof lastAttemptAtFallback === "number" &&
      new Date(lastAttemptAtFallback).toISOString().slice(0, 10) === todayKey;
    const fallbackToday = hasFallbackToday ? 1 : 0;
    const attempts = Math.max(metrics.attemptsByDay[todayKey] || 0, fallbackToday);
    const lastAttemptAt = Math.max(metrics.lastAttemptAt ?? 0, lastAttemptAtFallback ?? 0) || null;
    const setButtonLabel = (button: HTMLButtonElement | null, label: string) => {
      if (!button) {
        return;
      }
      button.textContent = label;
      button.setAttribute("aria-label", label);
    };

    if (elements.messageEl) {
      elements.messageEl.textContent = pickMessage(lang);
    }
    if (elements.blockedTagEl) {
      elements.blockedTagEl.textContent = t(lang, "blocked.tag");
    }
    if (elements.blockedTitleEl) {
      elements.blockedTitleEl.textContent = t(lang, "blocked.title");
    }
    if (elements.attemptsLabelEl) {
      elements.attemptsLabelEl.textContent = t(lang, "blocked.attempts_today");
    }
    if (elements.lastAttemptLabelEl) {
      elements.lastAttemptLabelEl.textContent = t(lang, "blocked.last_attempt");
    }
    if (elements.blockedReasonLabelEl) {
      elements.blockedReasonLabelEl.textContent = t(lang, "blocked.reason_label");
    }
    if (elements.blockedUrlLabelEl) {
      elements.blockedUrlLabelEl.textContent = t(lang, "blocked.url_prefix");
    }
    if (elements.attemptsEl) {
      elements.attemptsEl.textContent = String(attempts);
    }
    if (elements.lastAttemptEl) {
      elements.lastAttemptEl.textContent = lastAttemptAt
        ? formatDateTime(lang, lastAttemptAt, settings.timeFormat12h)
        : "-";
    }
    if (elements.blockedUrlEl) {
      elements.blockedUrlEl.textContent = blockedUrl || "";
    }

    if (elements.blockedReasonEl) {
      const decision = blockedUrl ? evaluateBlock(blockedUrl, settings, Date.now()) : null;
      const label = decision?.blocked ? reasonLabel(decision.reason, lang) : "";
      elements.blockedReasonEl.textContent = label || "-";

      if (elements.carryoverNoteEl) {
        const isCarryover = Boolean(decision?.blocked) && decision?.reason === "schedule" &&
          isCarryoverScheduleBlock(new Date(), settings.intervalsByDay);
        if (isCarryover) {
          elements.carryoverNoteEl.textContent = t(lang, "blocked.carryover");
          elements.carryoverNoteEl.setAttribute("data-visible", "true");
        } else {
          elements.carryoverNoteEl.textContent = "";
          elements.carryoverNoteEl.removeAttribute("data-visible");
        }
      }
    }
    if (elements.copyUrlBtn) {
      const copyBtn = elements.copyUrlBtn;
      const copyLabel = t(lang, "blocked.copy");
      setButtonLabel(copyBtn, copyLabel);
      copyBtn.disabled = !blockedUrl;
      copyBtn.onclick = async () => {
        if (!blockedUrl) {
          return;
        }
        try {
          await navigator.clipboard.writeText(blockedUrl);
          setButtonLabel(copyBtn, t(lang, "blocked.copied"));
          window.setTimeout(() => {
            setButtonLabel(copyBtn, copyLabel);
          }, 1500);
        } catch {
          // ignore
        }
      };
    }

    if (!elements.unblockBtn) {
      return;
    }

    const matchedDomain = blockedUrl ? matchBlockedDomain(blockedUrl, settings.blockedDomains) : null;
    const tags = matchedDomain ? settings.blockedDomainTags?.[matchedDomain] ?? [] : [];
    const hasIntervals = tags.includes("intervalos");
    const hasWeekly = tags.includes("por_semana");
    scheduleAutoUnblock.setEnabled(hasIntervals);

    if (!tags.length) {
      elements.unblockBtn.disabled = true;
      setButtonLabel(elements.unblockBtn, t(lang, "blocked.missing_tag"));
      return;
    }

    const now = Date.now();
    if (hasWeekly && !hasIntervals) {
      if (!settings.weeklyUnblockEnabled) {
        elements.unblockBtn.disabled = true;
        setButtonLabel(elements.unblockBtn, t(lang, "blocked.weekly.disabled"));
        return;
      }
      const weeklyActive = isWeeklySessionActive(settings, now);
      const dayKey = getWeeklySessionDayKey(now);
      const alreadyUsed = settings.weeklyUnblockLastWeek === dayKey;
      const allowedDays = settings.weeklyUnblockDays ?? [];
      const allowedToday = allowedDays.includes(new Date(now).getDay());
      const canStart = !weeklyActive && canStartWeeklySession(settings, now);
      const durationMs = getWeeklySessionDurationMs(settings);
      const durationMin = Math.max(1, Math.floor(durationMs / 60000));

      if (!canStart) {
        elements.unblockBtn.disabled = true;
        const label = weeklyActive
          ? t(lang, "blocked.weekly.used")
          : alreadyUsed
            ? t(lang, "blocked.weekly.used")
            : allowedToday
              ? t(lang, "blocked.weekly.used")
              : t(lang, "blocked.weekly.unavailable_day");
        setButtonLabel(elements.unblockBtn, label);
        return;
      }

      elements.unblockBtn.disabled = false;
      setButtonLabel(elements.unblockBtn, tf(lang, "blocked.weekly.unblock", { minutes: String(durationMin) }));
      elements.unblockBtn.onclick = async () => {
        const confirmOk = await confirmAction(lang, {
          title: t(lang, "blocked.confirm.weekly.title"),
          description: tf(lang, "blocked.confirm.weekly.desc", { minutes: String(durationMin) }),
          confirmLabel: t(lang, "blocked.confirm.confirm")
        });
        if (!confirmOk) {
          return;
        }
        blockedUrl = await resolveBlockedUrl(blockedUrl);
        const start = Date.now();
        const until = start + durationMs;
        await updateSettings({
          weeklyUnblockUntil: until,
          weeklyUnblockLastWeek: getWeeklySessionDayKey(start)
        });
        if (blockedUrl) {
          window.location.href = blockedUrl;
        }
      };
      return;
    }

    if (settings.strictMode) {
      elements.unblockBtn.disabled = true;
      setButtonLabel(elements.unblockBtn, t(lang, "blocked.strict_active"));
    } else {
      elements.unblockBtn.disabled = false;
      setButtonLabel(elements.unblockBtn, t(lang, "blocked.unblock"));
      elements.unblockBtn.onclick = async () => {
        const confirmOk = await confirmAction(lang, {
          title: t(lang, "blocked.confirm.temp.title"),
          description: t(lang, "blocked.confirm.temp.desc"),
          confirmLabel: t(lang, "blocked.confirm.confirm")
        });
        if (!confirmOk) {
          return;
        }
        blockedUrl = await resolveBlockedUrl(blockedUrl);
        const start = Date.now();
        await updateSettings({ unblockUntil: start + 5 * 60 * 1000 });
        if (blockedUrl) {
          window.location.href = blockedUrl;
        }
      };
    }

    if (elements.closeBtn) {
      setButtonLabel(elements.closeBtn, t(lang, "blocked.close"));
    }
  }

  elements.closeBtn?.addEventListener("click", () => {
    void closeBlockedTab();
  });

  void render();
  startBlockedTimer();
  scheduleAutoUnblock.start();

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || (!changes.settings && !changes.metrics)) {
        return;
      }
      void render().then(() => {
        if (changes.settings) {
          void scheduleAutoUnblock.checkOnce();
        }
      });
    });
  }
}
