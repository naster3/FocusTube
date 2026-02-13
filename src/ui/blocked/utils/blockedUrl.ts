import { hostnameMatches } from "../../../domain/blocking/url";
import type { MessageResponse } from "../../../shared/messages";
import { isValidOutgoingMessage } from "../../../shared/messages";

export const getInitialBlockedUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("url") || "";
};

export async function resolveBlockedUrl(currentUrl: string): Promise<string> {
  if (currentUrl) {
    return currentUrl;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = tabs?.[0]?.id;
    if (!tabId) {
      return "";
    }
    const message = { type: "GET_LAST_ATTEMPT", tabId };
    if (!isValidOutgoingMessage(message, "blocked")) {
      return "";
    }
    const res = (await chrome.runtime.sendMessage(message)) as MessageResponse<"GET_LAST_ATTEMPT"> | undefined;
    if (res?.ok && typeof res.url === "string") {
      return res.url;
    }
  } catch {
    // ignore
  }
  return "";
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
