import { hostnameMatches } from "../../../domain/blocking/url";
import type { MessageResponse } from "../../../shared/messages";
import { isValidOutgoingMessage } from "../../../shared/messages";

export type ResolvedBlockedAttempt = {
  url: string;
  at: number | null;
};

export const getInitialBlockedUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("url") || "";
};

export async function resolveBlockedAttempt(currentUrl: string): Promise<ResolvedBlockedAttempt> {
  if (currentUrl) {
    return { url: currentUrl, at: null };
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      return { url: "", at: null };
    }
    const message = { type: "GET_LAST_ATTEMPT", tabId };
    if (!isValidOutgoingMessage(message, "blocked")) {
      return { url: "", at: null };
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
  return { url: "", at: null };
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
