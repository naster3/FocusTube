import { BlockDecision, BlockReason, Settings } from "./types";
import { isWithinBlockedSchedule } from "./schedule";

// Normaliza input a hostname base.
export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return hostname || null;
  } catch {
    return null;
  }
}

// Match de subdominios o exacto.
export function hostnameMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// Determina si una URL pertenece a dominios bloqueados.
export function isTargetUrl(urlString: string, blockedDomains: string[]) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();
    return blockedDomains.some((domain) => hostnameMatches(hostname, domain));
  } catch {
    return false;
  }
}

// Detecta YouTube Kids.
export function isKidsDomain(urlString: string) {
  try {
    const url = new URL(urlString);
    return url.hostname === "youtubekids.com" || url.hostname.endsWith(".youtubekids.com");
  } catch {
    return false;
  }
}

// Detecta Shorts.
export function isShortsUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    return url.pathname.includes("/shorts/");
  } catch {
    return false;
  }
}

// Whitelist por URL o handle.
export function isWhitelisted(urlString: string, whitelist: string[]) {
  const normalizedUrl = urlString.toLowerCase();
  return whitelist.some((entryRaw) => {
    const entry = entryRaw.trim().toLowerCase();
    if (!entry) {
      return false;
    }
    if (entry.startsWith("@")) {
      return normalizedUrl.includes(`/@${entry.slice(1)}`);
    }
    return normalizedUrl.includes(entry);
  });
}

// Evalua bloqueo segun settings y horario.
export function evaluateBlock(urlString: string, settings: Settings, now: number): BlockDecision {
  if (!isTargetUrl(urlString, settings.blockedDomains)) {
    return { blocked: false, reason: "not_target" };
  }

  if (isWhitelisted(urlString, settings.whitelist)) {
    return { blocked: false };
  }

  if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
    return { blocked: false };
  }

  if (settings.blockEnabled) {
    return { blocked: true, reason: "manual" };
  }

  if (settings.blockKids && isKidsDomain(urlString)) {
    return { blocked: true, reason: "kids" };
  }

  if (settings.blockShorts && isShortsUrl(urlString)) {
    return { blocked: true, reason: "shorts" };
  }

  if (isWithinBlockedSchedule(new Date(now), settings.intervalsByDay)) {
    return { blocked: true, reason: "schedule" };
  }

  return { blocked: false };
}

// Etiquetas para UI.
export function reasonLabel(reason?: BlockReason) {
  switch (reason) {
    case "manual":
      return "Manual";
    case "kids":
      return "Kids";
    case "shorts":
      return "Shorts";
    case "schedule":
      return "Horario";
    case "not_target":
      return "";
    default:
      return "";
  }
}
