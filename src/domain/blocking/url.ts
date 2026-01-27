import { BlockDecision, BlockReason, Settings, Language, DomainTag } from "../settings/types";
import { t } from "../../shared/i18n";
import { isWithinBlockedSchedule } from "../schedule/schedule";
import { isWeeklySessionActive } from "../weekly/weekly";

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

type WhitelistEntry =
  | { type: "handle"; handle: string }
  | { type: "channelId"; channelId: string }
  | { type: "videoId"; videoId: string }
  | { type: "url"; host: string; path: string };

function normalizeHostname(hostname: string) {
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizePath(pathname: string) {
  const lowered = pathname.toLowerCase();
  if (lowered.length > 1 && lowered.endsWith("/")) {
    return lowered.slice(0, -1);
  }
  return lowered || "/";
}

function isYouTubeHost(hostname: string) {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
}

function parseUrlCandidate(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function extractHandleFromPath(pathname: string) {
  const idx = pathname.indexOf("/@");
  if (idx === -1) return null;
  const rest = pathname.slice(idx + 2);
  const handle = rest.split("/")[0];
  return handle ? handle.toLowerCase() : null;
}

function extractChannelIdFromPath(pathname: string) {
  if (!pathname.startsWith("/channel/")) return null;
  const rest = pathname.slice("/channel/".length);
  const channelId = rest.split("/")[0];
  return channelId ? channelId.toLowerCase() : null;
}

function extractYouTubeVideoId(url: URL) {
  const host = normalizeHostname(url.hostname);
  const path = normalizePath(url.pathname);
  if (host === "youtu.be") {
    const id = path.split("/").filter(Boolean)[0];
    return id ? id.toLowerCase() : null;
  }
  if (!host.endsWith("youtube.com")) return null;
  if (path === "/watch") {
    const v = url.searchParams.get("v");
    return v ? v.toLowerCase() : null;
  }
  if (path.startsWith("/shorts/")) {
    const id = path.slice("/shorts/".length).split("/")[0];
    return id ? id.toLowerCase() : null;
  }
  if (path.startsWith("/embed/")) {
    const id = path.slice("/embed/".length).split("/")[0];
    return id ? id.toLowerCase() : null;
  }
  return null;
}

function parseWhitelistEntry(raw: string): WhitelistEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    const handle = trimmed.slice(1).toLowerCase();
    return handle ? { type: "handle", handle } : null;
  }
  const url = parseUrlCandidate(trimmed);
  if (!url) return null;
  const host = normalizeHostname(url.hostname);
  const path = normalizePath(url.pathname);
  if (isYouTubeHost(host)) {
    const handle = extractHandleFromPath(path);
    if (handle) return { type: "handle", handle };
    const channelId = extractChannelIdFromPath(path);
    if (channelId) return { type: "channelId", channelId };
    const videoId = extractYouTubeVideoId(url);
    if (videoId) return { type: "videoId", videoId };
  }
  return { type: "url", host, path };
}

export function normalizeWhitelistEntry(raw: string): string | null {
  const entry = parseWhitelistEntry(raw);
  if (!entry) return null;
  if (entry.type === "handle") {
    return `@${entry.handle}`;
  }
  if (entry.type === "channelId") {
    return `https://www.youtube.com/channel/${entry.channelId}`;
  }
  if (entry.type === "videoId") {
    return `https://youtu.be/${entry.videoId}`;
  }
  if (!isYouTubeHost(entry.host)) {
    return null;
  }
  const host = entry.host === "youtube.com" ? "www.youtube.com" : entry.host;
  return `https://${host}${entry.path}`;
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

function matchDomain(hostname: string, blockedDomains: string[]) {
  return blockedDomains.find((domain) => hostnameMatches(hostname, domain)) || null;
}

function getDomainTags(settings: Settings, domain: string): DomainTag[] {
  return settings.blockedDomainTags?.[domain] ?? [];
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

// Detecta Instagram Reels.
export function isInstagramReelsUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const hostname = normalizeHostname(url.hostname);
    if (hostname !== "instagram.com" && !hostname.endsWith(".instagram.com")) {
      return false;
    }
    const path = normalizePath(url.pathname);
    return path.startsWith("/reel/") || path.startsWith("/reels/");
  } catch {
    return false;
  }
}

// Whitelist por URL o handle.
export function isWhitelisted(urlString: string, whitelist: string[]) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return false;
  }
  const host = normalizeHostname(url.hostname);
  const path = normalizePath(url.pathname);
  const handleFromPath = extractHandleFromPath(path);
  const channelIdFromPath = extractChannelIdFromPath(path);
  const videoId = extractYouTubeVideoId(url);
  const abChannel = url.searchParams.get("ab_channel")?.trim().toLowerCase() || null;

  return whitelist.some((entryRaw) => {
    const entry = parseWhitelistEntry(entryRaw);
    if (!entry) return false;
    if (entry.type === "handle") {
      return entry.handle === handleFromPath || entry.handle === abChannel;
    }
    if (entry.type === "channelId") {
      return entry.channelId === channelIdFromPath;
    }
    if (entry.type === "videoId") {
      return entry.videoId === videoId;
    }
    if (!hostnameMatches(host, entry.host)) return false;
    if (entry.path === "/") return true;
    return path.startsWith(entry.path);
  });
}

// Evalua bloqueo segun settings y horario.
export function evaluateBlock(urlString: string, settings: Settings, now: number): BlockDecision {
  let hostname: string | null = null;
  try {
    const url = new URL(urlString);
    hostname = url.hostname.toLowerCase();
  } catch {
    return { blocked: false, reason: "not_target" };
  }
  const matchedDomain = hostname ? matchDomain(hostname, settings.blockedDomains) : null;
  if (!matchedDomain) {
    return { blocked: false, reason: "not_target" };
  }

  if (isWhitelisted(urlString, settings.whitelist)) {
    return { blocked: false };
  }

  const tags = getDomainTags(settings, matchedDomain);
  if (!tags.length) {
    return { blocked: true, reason: "missing_tag" };
  }
  const hasIntervals = tags.includes("intervalos");
  const hasWeekly = tags.includes("por_semana");

  if (hasIntervals) {
    if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
      return { blocked: false };
    }

    if (settings.blockKids && isKidsDomain(urlString)) {
      return { blocked: true, reason: "kids" };
    }

    if (settings.blockShorts && isShortsUrl(urlString)) {
      return { blocked: true, reason: "shorts" };
    }

    if (settings.blockInstagramReels && isInstagramReelsUrl(urlString)) {
      return { blocked: true, reason: "manual" };
    }

    if (isWithinBlockedSchedule(new Date(now), settings.intervalsByDay)) {
      return { blocked: true, reason: "schedule" };
    }

    return { blocked: false };
  }

  if (hasWeekly) {
    if (settings.weeklyUnblockEnabled && isWeeklySessionActive(settings, now)) {
      return { blocked: false };
    }
    return { blocked: true, reason: "manual" };
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

  return { blocked: false };
}

// Etiquetas para UI.
export function reasonLabel(reason?: BlockReason, lang: Language = "en") {
  switch (reason) {
    case "manual":
      return t(lang, "reason.manual");
    case "kids":
      return t(lang, "reason.kids");
    case "shorts":
      return t(lang, "reason.shorts");
    case "schedule":
      return t(lang, "reason.schedule");
    case "missing_tag":
      return t(lang, "reason.missing_tag");
    case "not_target":
      return "";
    default:
      return "";
  }
}
