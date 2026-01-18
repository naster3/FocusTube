import { ensureSettingsLoaded, getActiveTabId, getTabState, setActiveTabId, setWindowFocused, tabStates } from "./state";
import { startSession } from "./metrics";

// Match del dominio objetivo contra la lista bloqueada.
function matchDomain(hostname: string, blockedDomains: string[]) {
  return blockedDomains.find((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) || null;
}

// Obtiene hostname de una URL segura.
function getHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

// Actualiza dominio objetivo y controla sesiones.
export async function updateTabTarget(tabId: number, url: string | null) {
  const settings = await ensureSettingsLoaded();
  const state = getTabState(tabId);
  const hostname = url ? getHostname(url) : null;
  const domain = hostname ? matchDomain(hostname, settings.blockedDomains) : null;
  const wasTarget = state.isTarget;
  state.domain = domain;
  state.isTarget = Boolean(domain);
  if (state.isTarget && !wasTarget) {
    startSession(tabId, Date.now());
  }
  if (!state.isTarget && state.sessionActive) {
    state.sessionActive = false;
  }
}

// Registro de listeners de tabs/ventanas.
export function registerTabListeners() {
  chrome.tabs.onActivated.addListener((info) => {
    const now = Date.now();
    const activeTabId = getActiveTabId();
    if (activeTabId !== null) {
      const prevState = getTabState(activeTabId);
      prevState.active = false;
      prevState.lastTick = now;
    }
    setActiveTabId(info.tabId);
    const state = getTabState(info.tabId);
    state.active = true;
    state.lastTick = now;
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (typeof changeInfo.url === "string") {
      void updateTabTarget(tabId, changeInfo.url);
    } else if (tab.url) {
      void updateTabTarget(tabId, tab.url);
    }
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    tabStates.delete(tabId);
    if (getActiveTabId() === tabId) {
      setActiveTabId(null);
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    setWindowFocused(windowId !== chrome.windows.WINDOW_ID_NONE);
  });
}
