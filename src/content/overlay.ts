// Overlay flotante para mostrar estado y countdown en paginas objetivo.
import overlayCss from "./overlay.css?raw";
import { safeSendMessage } from "./extensionMessaging";
import { t, tf } from "../shared/i18n";
import type { Language } from "../domain/settings/types";

const OVERLAY_VISUAL_TICK_MS = 1000;
const OVERLAY_SYNC_TICK_MS = 10000;
const OVERLAY_STYLE_ID = "focustube-overlay-styles";

const LANGUAGE_LOCALE_MAP: Record<Language, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR"
};

type OverlayTimeline = {
  state: "blocked" | "free";
  reason: string;
  currentUntil: number | null;
  nextBlockStart: number | null;
  nextBlockEnd: number | null;
};

type OverlaySettings = {
  language?: Language;
  timeFormat12h?: boolean;
  theme?: "light" | "dark" | "system";
};

declare global {
  interface Window {
    __FOCUSTUBE_OVERLAY__?: {
      initialized: boolean;
      teardown: () => void;
    };
  }
}

function ensureOverlayStyles() {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = OVERLAY_STYLE_ID;
  style.textContent = overlayCss;
  (document.head || document.documentElement).appendChild(style);
}

function formatDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

function formatOverlayTime(ts: number, locale: string, hour12Preference: boolean | null) {
  try {
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: typeof hour12Preference === "boolean" ? hour12Preference : undefined
    }).format(ts);
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

function localeFromLanguage(language?: Language) {
  if (!language) {
    return navigator.language || "en-US";
  }
  return LANGUAGE_LOCALE_MAP[language] || navigator.language || "en-US";
}

function resolveTheme(theme: "light" | "dark" | "system" | undefined): "light" | "dark" {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function createOverlayElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  return el;
}

/**
 * Widget flotante y draggable que se muestra en YouTube.
 * Lee el timeline de horarios desde background (igual que el popup).
 */
export function initFloatingTimerOverlay() {
  if (window.top !== window) {
    return;
  }
  if (window.__FOCUSTUBE_OVERLAY__?.initialized) {
    return;
  }

  ensureOverlayStyles();

  const root = createOverlayElement("div", "focustube-overlay-root");
  root.id = "focustube-overlay";
  root.setAttribute("role", "region");
  root.setAttribute("data-state", "loading");

  const box = createOverlayElement("div", "focustube-overlay-box");
  const header = createOverlayElement("div", "focustube-overlay-header");
  const title = createOverlayElement("div", "focustube-overlay-title");
  title.textContent = "FocusTube";
  const btns = createOverlayElement("div", "focustube-overlay-btns");

  const btnMin = createOverlayElement("button", "focustube-overlay-btn");
  btnMin.type = "button";
  btnMin.textContent = "-";
  btnMin.setAttribute("aria-controls", "focustube-overlay-body");

  const btnClose = createOverlayElement("button", "focustube-overlay-btn");
  btnClose.type = "button";
  btnClose.textContent = "x";

  btns.appendChild(btnMin);
  btns.appendChild(btnClose);
  header.appendChild(title);
  header.appendChild(btns);

  const body = createOverlayElement("div", "focustube-overlay-body");
  body.id = "focustube-overlay-body";
  const line1 = createOverlayElement("div", "focustube-overlay-line1");
  line1.textContent = "Loading...";
  const big = createOverlayElement("div", "focustube-overlay-big");
  big.textContent = "--:--";
  const line2 = createOverlayElement("div", "focustube-overlay-line2");
  const line3 = createOverlayElement("div", "focustube-overlay-line3");
  body.appendChild(line1);
  body.appendChild(big);
  body.appendChild(line2);
  body.appendChild(line3);

  box.appendChild(header);
  box.appendChild(body);
  root.appendChild(box);
  document.documentElement.appendChild(root);

  const cleanupFns: Array<() => void> = [];
  const addCleanup = (fn: () => void) => cleanupFns.push(fn);
  let destroyed = false;
  let minimized = false;
  let restoreBtn: HTMLButtonElement | null = null;
  let lang: Language = "en";
  let locale = navigator.language || "en-US";
  let timeFormat12h: boolean | null = null;
  let themePreference: "light" | "dark" | "system" = "system";
  let hasTimelineResponse = false;
  let timeline: OverlayTimeline | null = null;

  const setOverlayState = (state: "loading" | "unknown" | "blocked" | "free") => {
    root.setAttribute("data-state", state);
  };

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const positionOverlay = (left: number, top: number) => {
    const maxLeft = Math.max(0, window.innerWidth - root.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - root.offsetHeight);
    root.style.left = `${clamp(left, 0, maxLeft)}px`;
    root.style.top = `${clamp(top, 0, maxTop)}px`;
  };

  const reasonLabel = (reason: string) => {
    switch (reason) {
      case "manual":
        return t(lang, "overlay.reason.manual");
      case "temporary_unblock":
        return t(lang, "overlay.reason.temp");
      case "schedule":
      case "schedule_free":
        return t(lang, "overlay.reason.schedule");
      default:
        return reason;
    }
  };

  const render = (now: number) => {
    if (destroyed) {
      return;
    }

    line3.textContent = `${t(lang, "overlay.now")}: ${formatOverlayTime(now, locale, timeFormat12h)}`;

    if (!hasTimelineResponse) {
      setOverlayState("loading");
      line1.textContent = t(lang, "overlay.loading");
      big.textContent = "--:--";
      line2.textContent = "";
      return;
    }

    if (!timeline) {
      setOverlayState("unknown");
      line1.textContent = t(lang, "overlay.no_state");
      big.textContent = "--:--";
      line2.textContent = "";
      return;
    }

    const until = timeline.currentUntil;
    if (timeline.state === "blocked") {
      setOverlayState("blocked");
      line1.textContent = t(lang, "overlay.blocked");
      big.textContent = until ? formatDuration(until - now) : "--:--";
      line2.textContent = `${t(lang, "overlay.reason")}: ${reasonLabel(timeline.reason)}`;
      return;
    }

    setOverlayState("free");
    line1.textContent = t(lang, "overlay.free");
    big.textContent = until ? formatDuration(until - now) : "--:--";
    if (timeline.nextBlockStart && timeline.nextBlockEnd) {
      line2.textContent = tf(lang, "overlay.next_block", {
        duration: formatDuration(timeline.nextBlockEnd - timeline.nextBlockStart)
      });
    } else {
      line2.textContent = "";
    }
  };

  const updateMinimizeControlState = () => {
    btnMin.textContent = minimized ? "+" : "-";
    btnMin.setAttribute("aria-pressed", String(minimized));
    btnMin.setAttribute("aria-expanded", String(!minimized));
  };

  const applyStaticLabels = () => {
    const minimizeLabel = minimized ? t(lang, "overlay.show") : t(lang, "overlay.minimize");
    const hideLabel = t(lang, "overlay.hide");
    const regionLabel = t(lang, "overlay.title");
    title.textContent = regionLabel;
    root.setAttribute("aria-label", regionLabel);
    btnMin.title = minimizeLabel;
    btnMin.setAttribute("aria-label", minimizeLabel);
    btnClose.title = hideLabel;
    btnClose.setAttribute("aria-label", hideLabel);
    if (restoreBtn) {
      const restoreLabel = t(lang, "overlay.show");
      restoreBtn.textContent = restoreLabel;
      restoreBtn.title = restoreLabel;
      restoreBtn.setAttribute("aria-label", restoreLabel);
      restoreBtn.setAttribute("data-theme", resolveTheme(themePreference));
    }
    render(Date.now());
  };

  const applyTheme = () => {
    const resolvedTheme = resolveTheme(themePreference);
    root.setAttribute("data-theme", resolvedTheme);
    if (restoreBtn) {
      restoreBtn.setAttribute("data-theme", resolvedTheme);
    }
  };

  const loadOverlaySettings = async () => {
    try {
      const stored = await chrome.storage.local.get("settings");
      const settings = stored.settings as OverlaySettings | undefined;
      lang = settings?.language || "en";
      locale = localeFromLanguage(settings?.language);
      timeFormat12h = typeof settings?.timeFormat12h === "boolean" ? settings.timeFormat12h : null;
      themePreference = settings?.theme || "system";
    } catch {
      locale = navigator.language || "en-US";
      timeFormat12h = null;
      themePreference = "system";
    }
    applyTheme();
    applyStaticLabels();
  };

  const syncTimeline = (force = false) => {
    if (!force && document.visibilityState !== "visible") {
      return;
    }
    safeSendMessage<"GET_TIMELINE">({ type: "GET_TIMELINE" }, (res) => {
      if (destroyed) {
        return;
      }
      hasTimelineResponse = true;
      timeline = res?.ok && res.timeline ? (res.timeline as OverlayTimeline) : null;
      render(Date.now());
    });
  };

  const onMinimizeClick = (e: MouseEvent) => {
    e.stopPropagation();
    minimized = !minimized;
    body.hidden = minimized;
    root.classList.toggle("is-minimized", minimized);
    updateMinimizeControlState();
    applyStaticLabels();
  };
  btnMin.addEventListener("click", onMinimizeClick);
  addCleanup(() => btnMin.removeEventListener("click", onMinimizeClick));

  const onCloseClick = (e: MouseEvent) => {
    e.stopPropagation();
    root.style.display = "none";
    showRestoreButton();
  };
  btnClose.addEventListener("click", onCloseClick);
  addCleanup(() => btnClose.removeEventListener("click", onCloseClick));

  const stopDragFromButtons = (e: PointerEvent) => {
    e.stopPropagation();
  };
  btnMin.addEventListener("pointerdown", stopDragFromButtons);
  btnClose.addEventListener("pointerdown", stopDragFromButtons);
  addCleanup(() => btnMin.removeEventListener("pointerdown", stopDragFromButtons));
  addCleanup(() => btnClose.removeEventListener("pointerdown", stopDragFromButtons));

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onPointerDown = (e: PointerEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "BUTTON" || target.closest("button"))) {
      return;
    }
    dragging = true;
    header.classList.add("is-dragging");
    header.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    const rect = root.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) {
      return;
    }
    positionOverlay(startLeft + (e.clientX - startX), startTop + (e.clientY - startY));
  };
  const persistPosition = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    header.classList.remove("is-dragging");
    const rect = root.getBoundingClientRect();
    void chrome.storage.local.set({
      overlayPos: { left: Math.round(rect.left), top: Math.round(rect.top) }
    });
  };
  header.addEventListener("pointerdown", onPointerDown);
  header.addEventListener("pointermove", onPointerMove);
  header.addEventListener("pointerup", persistPosition);
  header.addEventListener("pointercancel", persistPosition);
  addCleanup(() => header.removeEventListener("pointerdown", onPointerDown));
  addCleanup(() => header.removeEventListener("pointermove", onPointerMove));
  addCleanup(() => header.removeEventListener("pointerup", persistPosition));
  addCleanup(() => header.removeEventListener("pointercancel", persistPosition));

  function showRestoreButton() {
    if (restoreBtn) {
      restoreBtn.style.display = "block";
      return;
    }
    const button = createOverlayElement("button", "focustube-overlay-restore-btn");
    restoreBtn = button;
    button.type = "button";
    const onRestoreClick = () => {
      root.style.display = "block";
      const rect = root.getBoundingClientRect();
      positionOverlay(rect.left, rect.top);
      button.removeEventListener("click", onRestoreClick);
      button.remove();
      restoreBtn = null;
      applyStaticLabels();
    };
    button.addEventListener("click", onRestoreClick);
    document.documentElement.appendChild(button);
    applyStaticLabels();
  }

  const onResize = () => {
    const rect = root.getBoundingClientRect();
    positionOverlay(rect.left, rect.top);
  };
  window.addEventListener("resize", onResize);
  addCleanup(() => window.removeEventListener("resize", onResize));

  const onThemeMediaChange = () => {
    if (themePreference !== "system") {
      return;
    }
    applyTheme();
  };
  const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
  themeMedia.addEventListener("change", onThemeMediaChange);
  addCleanup(() => themeMedia.removeEventListener("change", onThemeMediaChange));

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      syncTimeline(true);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  addCleanup(() => document.removeEventListener("visibilitychange", onVisibilityChange));

  const visualTickId = window.setInterval(() => {
    if (document.visibilityState !== "visible") {
      return;
    }
    render(Date.now());
  }, OVERLAY_VISUAL_TICK_MS);
  addCleanup(() => window.clearInterval(visualTickId));

  const syncTickId = window.setInterval(() => {
    syncTimeline(false);
  }, OVERLAY_SYNC_TICK_MS);
  addCleanup(() => window.clearInterval(syncTickId));

  const onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !changes.settings) {
      return;
    }
    void loadOverlaySettings();
  };
  chrome.storage.onChanged.addListener(onStorageChanged);
  addCleanup(() => chrome.storage.onChanged.removeListener(onStorageChanged));

  const teardown = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    while (cleanupFns.length > 0) {
      const fn = cleanupFns.pop();
      try {
        fn?.();
      } catch {
        // cleanup defensivo
      }
    }
    if (restoreBtn) {
      restoreBtn.remove();
      restoreBtn = null;
    }
    root.remove();
    const style = document.getElementById(OVERLAY_STYLE_ID);
    style?.remove();
    if (window.__FOCUSTUBE_OVERLAY__?.teardown === teardown) {
      delete window.__FOCUSTUBE_OVERLAY__;
    }
  };

  window.__FOCUSTUBE_OVERLAY__ = { initialized: true, teardown };

  const onPageHide = () => teardown();
  window.addEventListener("pagehide", onPageHide);
  addCleanup(() => window.removeEventListener("pagehide", onPageHide));

  updateMinimizeControlState();
  void chrome.storage.local.get("overlayPos").then((res) => {
    if (destroyed) {
      return;
    }
    const pos = res.overlayPos as { left: number; top: number } | undefined;
    if (!pos) {
      return;
    }
    positionOverlay(pos.left, pos.top);
  });
  render(Date.now());
  void loadOverlaySettings();
  syncTimeline(true);
}
