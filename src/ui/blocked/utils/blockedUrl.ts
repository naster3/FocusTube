import { hostnameMatches } from "../../../domain/blocking/url";
import type { MessageResponse } from "../../../shared/messages";
import { isValidOutgoingMessage } from "../../../shared/messages";

export type ResolvedBlockedAttempt = {
  url: string;
  at: number | null;
};

function getHttpReferrerUrl() {
  const referrer = document.referrer || "";
  if (!referrer) {
    return "";
  }
  try {
    const parsed = new URL(referrer);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? referrer : "";
  } catch {
    return "";
  }
}

export const getInitialBlockedUrl = () => {
  const params = new URLSearchParams(window.location.search);
  // Primero intentamos query param; si no existe, usamos referrer HTTP para recargas/manual open.
  return params.get("url") || getHttpReferrerUrl();
};

export async function resolveBlockedAttempt(currentUrl: string): Promise<ResolvedBlockedAttempt> {
  if (currentUrl) {
    return { url: currentUrl, at: null };
  }
  try {
    // El background conserva el ultimo intento por pestana para reconstruir blocked.html.
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      return { url: getHttpReferrerUrl(), at: null };
    }
    const message = { type: "GET_LAST_ATTEMPT", tabId };
    if (!isValidOutgoingMessage(message, "blocked")) {
      return { url: getHttpReferrerUrl(), at: null };
    }
    const res = (await chrome.runtime.sendMessage(message)) as MessageResponse<"GET_LAST_ATTEMPT"> | undefined;
    if (res?.ok) {
      const url = typeof res.url === "string" ? res.url : "";
      const at = typeof res.at === "number" ? res.at : null;
      return { url, at };
    }
  } catch {
    // ignore
  }
  return { url: getHttpReferrerUrl(), at: null };
}

export async function resolveBlockedUrl(currentUrl: string): Promise<string> {
  const resolved = await resolveBlockedAttempt(currentUrl);
  return resolved.url;
}

export function matchBlockedDomain(urlString: string, blockedDomains: string[]) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return blockedDomains.find((domain) => hostnameMatches(hostname, domain)) || null;
  } catch {
    return null;
  }
}
