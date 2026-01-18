import { getSettings } from "../infrastructure/storage";
import { isWhitelisted } from "../core/url";

// YouTube: permitir videos (/watch) por canal (handle @) aunque youtube.com estAc bloqueado.
export function isYouTubeWatchUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const host = url.hostname.toLowerCase();
    if (host !== "youtube.com" && !host.endsWith(".youtube.com")) {
      return false;
    }
    return url.pathname === "/watch";
  } catch {
    return false;
  }
}

// Extrae el handle desde href relativo o absoluto.
function extractHandleFromHref(href: string) {
  if (!href) return null;
  try {
    const u = href.startsWith("http") ? new URL(href) : new URL(href, window.location.origin);
    const path = u.pathname;
    const idx = path.indexOf("/@");
    if (idx === -1) return null;
    const rest = path.slice(idx + 2);
    const handle = rest.split(/[/?#]/)[0];
    return handle ? handle.toLowerCase() : null;
  } catch {
    const m = href.match(/\/\@([a-zA-Z0-9._-]+)/);
    return m?.[1]?.toLowerCase() ?? null;
  }
}

// Busca el handle del canal en el DOM del watch.
function findYouTubeHandleInDom(): string | null {
  const ownerRoot =
    document.querySelector("ytd-video-owner-renderer") ||
    document.querySelector("#owner") ||
    document.querySelector("ytd-watch-metadata");

  const scoped = (root: ParentNode | null) => {
    if (!root) return null;
    const a = root.querySelector<HTMLAnchorElement>('a[href^="/@"], a[href*="/@@"]'.replace("/@@", "/@"));
    if (a) {
      return extractHandleFromHref(a.getAttribute("href") || a.href);
    }
    const a2 = root.querySelector<HTMLAnchorElement>('a[href*="/@"]');
    if (a2) {
      return extractHandleFromHref(a2.getAttribute("href") || a2.href);
    }
    return null;
  };

  const fromOwner = scoped(ownerRoot);
  if (fromOwner) return fromOwner;

  const any = document.querySelector<HTMLAnchorElement>('a[href^="/@"], a[href*="/@"]');
  if (any) {
    return extractHandleFromHref(any.getAttribute("href") || any.href);
  }
  return null;
}

// Espera el handle mientras el DOM termina de renderizar.
async function waitForYouTubeHandle(timeoutMs: number, onTick?: (msLeft: number) => void): Promise<string | null> {
  const start = Date.now();
  const first = findYouTubeHandleInDom();
  if (first) return first;

  return await new Promise((resolve) => {
    const tickMs = 150;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const left = Math.max(0, timeoutMs - elapsed);
      onTick?.(left);
      const found = findYouTubeHandleInDom();
      if (found) {
        window.clearInterval(timer);
        resolve(found);
        return;
      }
      if (elapsed >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, tickMs);
  });
}

// Permite /watch si el canal o ab_channel esta en whitelist.
export async function allowWhitelistedYouTubeWatchIfPossible(
  guardSetLabel?: (label: string) => void
): Promise<boolean> {
  if (!isYouTubeWatchUrl(window.location.href)) {
    return false;
  }

  // Lee settings directo del storage (local).
  const settings = await getSettings();
  if (isWhitelisted(window.location.href, settings.whitelist)) {
    return true;
  }

  // Intenta con handle (canal).
  guardSetLabel?.("Verificando canal...");
  const handle = await waitForYouTubeHandle(4500, (left) => {
    if (left % 900 < 150) {
      guardSetLabel?.("Verificando canal...");
    }
  });

  if (handle) {
    const channelUrl = `https://www.youtube.com/@${handle}`;
    if (isWhitelisted(channelUrl, settings.whitelist)) {
      return true;
    }
  }

  // Fallback: ab_channel puede ayudar cuando no hay handle.
  try {
    const url = new URL(window.location.href);
    const ab = url.searchParams.get("ab_channel");
    if (ab) {
      const abNorm = ab.trim().toLowerCase();
      const hit = settings.whitelist.some((entryRaw) => {
        const entry = entryRaw.trim().toLowerCase();
        if (!entry) return false;
        if (entry.startsWith("@")) {
          return entry.slice(1) === abNorm;
        }
        return entry === abNorm;
      });
      if (hit) {
        return true;
      }
    }
  } catch {
    // noop
  }

  return false;
}


