import { ensureDefaults } from "../infrastructure/storage";
import { ensureDbReady } from "../infrastructure/db";
import { ensureSettingsLoaded } from "./state";

// ID fijo para registrar content scripts de forma dinamica.
const CONTENT_SCRIPT_ID = "focustube-dynamic";

// Construye patrones de match para content script.
function buildMatches(domains: string[]) {
  const matches = domains.flatMap((domain) => [`*://${domain}/*`, `*://*.${domain}/*`]);
  return Array.from(new Set(matches));
}

// Registra content scripts segun dominios permitidos.
export async function syncRegisteredContentScripts(blockedDomains: string[]) {
  const matches = buildMatches(blockedDomains);
  const existing = await chrome.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_ID]
  });
  const alreadyRegistered = existing.length > 0;
  try {
    if (alreadyRegistered) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
    }
  } catch {
    // Best effort cleanup before re-registering.
  }

  if (matches.length === 0) {
    return;
  }

  try {
    await chrome.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_ID,
        js: ["content.js"],
        matches,
        runAt: "document_start"
      }
    ]);
  } catch (error) {
    const message = (error as Error)?.message || "";
    if (message.includes("Duplicate script ID")) {
      await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
      await chrome.scripting.registerContentScripts([
        {
          id: CONTENT_SCRIPT_ID,
          js: ["content.js"],
          matches,
          runAt: "document_start"
        }
      ]);
    } else {
      throw error;
    }
  }
}

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

// Reinyecta content script en pestanas ya abiertas cuando cambian dominios.
export async function reinjectContentScriptIntoOpenTabs(blockedDomains: string[]) {
  if (!blockedDomains || blockedDomains.length === 0) {
    return;
  }
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    const tabId = tab.id;
    const url = tab.url;
    if (!tabId || !url) {
      continue;
    }
    const hostname = getHostname(url);
    if (!hostname) {
      continue;
    }
    const domain = matchDomain(hostname, blockedDomains);
    if (!domain) {
      continue;
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });
    } catch {
      // Best effort (puede fallar si no hay permiso de host en esa pestana).
    }
  }
}

// Boot del SW: defaults + registrar content scripts.
export async function bootstrapContentScripts() {
  await ensureDefaults();
  await ensureDbReady();
  const settings = await ensureSettingsLoaded();
  if (!settings) {
    return;
  }
  await syncRegisteredContentScripts(settings.blockedDomains);
  await reinjectContentScriptIntoOpenTabs(settings.blockedDomains);
}
