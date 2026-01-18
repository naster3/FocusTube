import { safeSendMessage } from "./extensionMessaging";
import { t, tf } from "../core/i18n";
import type { Language } from "../core/types";

// Formatea hora AM/PM para el widget.
function formatTimeAmPm(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

/**
 * Floating, draggable countdown widget shown directly on YouTube pages.
 * It reads the same schedule timeline as the popup (via background).
 */
export function initFloatingTimerOverlay() {
  // Evita duplicados en SPA.
  // Evita duplicados (YouTube es SPA y re-renderiza seguido).
  // Avoid duplicates (YouTube is SPA and re-renders a lot)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.__FOCUSTUBE_OVERLAY__) return;
  w.__FOCUSTUBE_OVERLAY__ = true;

  // No ejecutar en iframes.
  // No ejecutar en iframes.
  if (window.top !== window) return;

  // DOM base del widget.
  // DOM base del widget.
  const root = document.createElement("div");
  root.id = "focustube-overlay";
  root.style.cssText = `
    position: fixed;
    left: 16px;
    top: 16px;
    z-index: 2147483647;
    width: 240px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    user-select: none;
    color-scheme: dark;
  `;

  const box = document.createElement("div");
  box.style.cssText = `
    border: 1px solid rgba(255,255,255,0.14);
    background: rgba(18,18,18,0.82);
    color: rgba(255,255,255,0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 16px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.35);
    overflow: hidden;
  `;

  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 10px;
    cursor: grab;
    background: rgba(255,255,255,0.06);
  `;

  const title = document.createElement("div");
  title.textContent = "FocusTube";
  title.style.cssText = `font-weight: 800; font-size: 13px; letter-spacing: 0.3px;`;

  const btns = document.createElement("div");
  btns.style.cssText = `display:flex; gap:6px; align-items:center;`;

  const btnMin = document.createElement("button");
  btnMin.textContent = "-";
  btnMin.title = "Minimizar";
  btnMin.style.cssText = miniBtnStyle();
  btnMin.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  const btnClose = document.createElement("button");
  btnClose.textContent = "A-";
  btnClose.title = "Ocultar (vuelve al recargar)";
  btnClose.style.cssText = miniBtnStyle();
  btnClose.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  btns.appendChild(btnMin);
  btns.appendChild(btnClose);

  header.appendChild(title);
  header.appendChild(btns);

  const body = document.createElement("div");
  body.style.cssText = `padding: 10px 12px 12px; display:grid; gap:8px;`;

  const line1 = document.createElement("div");
  line1.style.cssText = `font-size: 12px; opacity: 0.85;`;
  line1.textContent = "Loading...";

  const big = document.createElement("div");
  big.style.cssText = `font-size: 18px; font-weight: 900; letter-spacing: 0.2px;`;
  big.textContent = "--:--";

  const line2 = document.createElement("div");
  line2.style.cssText = `font-size: 11px; opacity: 0.7;`;
  line2.textContent = "";

  const line3 = document.createElement("div");
  line3.style.cssText = `font-size: 11px; opacity: 0.7;`;
  line3.textContent = "";

  body.appendChild(line1);
  body.appendChild(big);
  body.appendChild(line2);
  body.appendChild(line3);

  box.appendChild(header);
  box.appendChild(body);
  root.appendChild(box);
  document.documentElement.appendChild(root);

  // Restaura posicion guardada.
  // Restaura posicion guardada.
  void chrome.storage.local.get("overlayPos").then((res) => {
    const pos = res.overlayPos as { left: number; top: number } | undefined;
    if (!pos) return;
    root.style.left = `${pos.left}px`;
    root.style.top = `${pos.top}px`;
  });

  // Minimizar / ocultar.
  // Minimizar / ocultar.
  let minimized = false;
  let restoreBtn: HTMLButtonElement | null = null;
  let lang: Language = "en";
  const applyStaticLabels = () => {
    title.textContent = t(lang, "overlay.title");
    btnMin.title = t(lang, "overlay.minimize");
    btnClose.title = t(lang, "overlay.hide");
    if (!minimized) {
      line1.textContent = t(lang, "overlay.loading");
    }
    if (restoreBtn) {
      restoreBtn.textContent = t(lang, "overlay.show");
    }
  };

  const loadLanguage = async () => {
    try {
      const stored = await chrome.storage.local.get("settings");
      const next = (stored.settings as { language?: Language } | undefined)?.language;
      if (next) {
        lang = next;
      }
    } catch {
      // ignore
    }
    applyStaticLabels();
  };
  btnMin.addEventListener("click", (e) => {
    e.stopPropagation();
    minimized = !minimized;
    body.style.display = minimized ? "none" : "grid";
    btnMin.textContent = minimized ? "+" : "-";
  });

  btnClose.addEventListener("click", (e) => {
    e.stopPropagation();
    root.style.display = "none";
    showRestoreButton();
  });

  // Drag del widget.
  // Dragging del widget.
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  header.addEventListener("pointerdown", (e) => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "BUTTON" || target.closest("button"))) {
      return;
    }
    dragging = true;
    header.style.cursor = "grabbing";
    header.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;

    const rect = root.getBoundingClientRect();
    startLeft = rect.left;
    startTop = rect.top;
  });

  header.addEventListener("pointermove", (e) => {
    if (!dragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    const left = clamp(startLeft + dx, 0, window.innerWidth - root.offsetWidth);
    const top = clamp(startTop + dy, 0, window.innerHeight - root.offsetHeight);

    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
  });

  header.addEventListener("pointerup", () => {
    if (!dragging) return;
    dragging = false;
    header.style.cursor = "grab";

    const rect = root.getBoundingClientRect();
    void chrome.storage.local.set({
      overlayPos: { left: Math.round(rect.left), top: Math.round(rect.top) },
    });
  });

  // Helpers y tick del timeline.
  // Helpers para duracion y etiquetas.
  function formatDuration(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
  }

  function reasonLabel(reason: string) {
    switch (reason) {
      case "manual":
        return t(lang, "overlay.reason.manual");
      case "temporary_unblock":
        return t(lang, "overlay.reason.temp");
      case "schedule":
        return t(lang, "overlay.reason.schedule");
      case "schedule_free":
        return t(lang, "overlay.reason.schedule");
      default:
        return reason;
    }
  }

  // Poll al background para estado del timeline.
  function tick() {
    line3.textContent = `${t(lang, "overlay.now")}: ${formatTimeAmPm(Date.now())}`;
    safeSendMessage<{ ok: boolean; timeline?: unknown }>({ type: "GET_TIMELINE" }, (res) => {
      if (!res?.ok || !res.timeline) {
        line1.textContent = t(lang, "overlay.no_state");
        big.textContent = "--:--";
        line2.textContent = "";
        line3.textContent = `${t(lang, "overlay.now")}: ${formatTimeAmPm(Date.now())}`;
        return;
      }

      const t = res.timeline as {
        state: "blocked" | "free";
        reason: string;
        currentUntil: number | null;
        nextBlockStart: number | null;
        nextBlockEnd: number | null;
      };

      const now = Date.now();
      const until = t.currentUntil;

      if (t.state === "blocked") {
        line1.textContent = t(lang, "overlay.blocked");
        big.textContent = until ? formatDuration(until - now) : "ƒ^z";
        line2.textContent = `${t(lang, "overlay.reason")}: ${reasonLabel(t.reason)}`;
      } else {
        line1.textContent = t(lang, "overlay.free");
        big.textContent = until ? formatDuration(until - now) : "ƒ^z";
        if (t.nextBlockStart && t.nextBlockEnd) {
          line2.textContent = tf(lang, "overlay.next_block", {
            duration: formatDuration(t.nextBlockEnd - t.nextBlockStart)
          });
        } else {
          line2.textContent = "";
        }
      }
    });
  }

  // Arranque inicial y tick cada segundo.
  tick();
  window.setInterval(tick, 1000);

  // Estilo reutilizable para botones.
  function miniBtnStyle() {
    return `
      width: 26px;
      height: 22px;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.92);
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
    `;
  }

  function showRestoreButton() {
    if (restoreBtn) {
      restoreBtn.style.display = "block";
      return;
    }
    restoreBtn = document.createElement("button");
    restoreBtn.textContent = t(lang, "overlay.show");
    restoreBtn.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      padding: 8px 12px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(18,18,18,0.82);
      color: rgba(255,255,255,0.92);
      cursor: pointer;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.2px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.35);
    `;
    restoreBtn.addEventListener("click", () => {
      root.style.display = "block";
      restoreBtn?.remove();
      restoreBtn = null;
    });
    document.documentElement.appendChild(restoreBtn);
  }

  void loadLanguage();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.settings) {
      return;
    }
    void loadLanguage();
  });
}
