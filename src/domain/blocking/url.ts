import { BlockDecision, BlockReason, Settings, Language, DomainTag } from "../settings/types";
import { t } from "../../shared/i18n";
import { isWithinBlockedSchedule } from "../schedule/schedule";
import { isWeeklySessionActive } from "../weekly/weekly";
import { devLog } from "../../shared/devLogger";

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
  // Normalizamos `www.` para comparar dominios equivalentes con una sola forma canonica.
  return hostname.toLowerCase().replace(/^www\./, "");
}

function normalizePath(pathname: string) {
  // Quitamos slash final para que `/canal` y `/canal/` no se traten como rutas distintas.
  const lowered = pathname.toLowerCase();
  if (lowered.length > 1 && lowered.endsWith("/")) {
    return lowered.slice(0, -1);
  }
  return lowered || "/";
}

function isYouTubeHost(hostname: string) {
  // Incluye youtube.com, sus subdominios y el acortador youtu.be.
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com") || hostname === "youtu.be";
}

function parseUrlCandidate(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // Permitimos entradas sin esquema (`youtube.com/...`) agregando https para parsearlas.
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

function extractHandleFromPath(pathname: string) {
  // Los handles modernos de YouTube viven en rutas tipo `/@canal`.
  const idx = pathname.indexOf("/@");
  if (idx === -1) return null;
  const rest = pathname.slice(idx + 2);
  const handle = rest.split("/")[0];
  return handle ? handle.toLowerCase() : null;
}

function extractChannelIdFromPath(pathname: string) {
  // Fallback para canales antiguos o URLs compartidas con channelId explicito.
  if (!pathname.startsWith("/channel/")) return null;
  const rest = pathname.slice("/channel/".length);
  const channelId = rest.split("/")[0];
  return channelId ? channelId.toLowerCase() : null;
}

function extractYouTubeVideoId(url: URL) {
  const host = normalizeHostname(url.hostname);
  const path = normalizePath(url.pathname);
  if (host === "youtu.be") {
    // En youtu.be el id viene en el primer segmento del path.
    const id = path.split("/").filter(Boolean)[0];
    return id ? id.toLowerCase() : null;
  }
  if (!host.endsWith("youtube.com")) return null;
  if (path === "/watch") {
    // URL clasica de YouTube: el id viene en el query param `v`.
    const v = url.searchParams.get("v");
    return v ? v.toLowerCase() : null;
  }
  if (path.startsWith("/shorts/")) {
    // Shorts tambien usa el id como segmento de ruta.
    const id = path.slice("/shorts/".length).split("/")[0];
    return id ? id.toLowerCase() : null;
  }
  if (path.startsWith("/embed/")) {
    // Compatibilidad con embeds para que la whitelist reconozca el mismo video.
    const id = path.slice("/embed/".length).split("/")[0];
    return id ? id.toLowerCase() : null;
  }
  return null;
}

function parseWhitelistEntry(raw: string): WhitelistEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) {
    // Si el usuario guardo un handle directo, no hace falta parsear una URL.
    const handle = trimmed.slice(1).toLowerCase();
    return handle ? { type: "handle", handle } : null;
  }
  // Tambien aceptamos URLs y las convertimos al identificador mas estable que podamos extraer.
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
    // Guardamos handles con una forma unica para evitar duplicados por mayusculas o formato.
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
    // El bloqueo por dominio aplica a coincidencias exactas y a subdominios.
    return blockedDomains.some((domain) => hostnameMatches(hostname, domain));
  } catch {
    return false;
  }
}

function matchDomain(hostname: string, blockedDomains: string[]) {
  return blockedDomains.find((domain) => hostnameMatches(hostname, domain)) || null;
}

function getDomainTags(settings: Settings, domain: string): DomainTag[] {
  // Cada dominio puede tener varias estrategias activas; la decision final depende de esas tags.
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
      // `ab_channel` cubre casos donde YouTube no expone el handle en el path actual.
      return entry.handle === handleFromPath || entry.handle === abChannel;
    }
    if (entry.type === "channelId") {
      // Match exacto por channelId para resistir cambios de handle o branding del canal.
      return entry.channelId === channelIdFromPath;
    }
    if (entry.type === "videoId") {
      // Match exacto por video para permitir piezas individuales aunque el canal no este permitido.
      return entry.videoId === videoId;
    }
    if (!hostnameMatches(host, entry.host)) return false;
    // Una URL con path `/` habilita todo el host; una ruta mas larga habilita ese prefijo.
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
    // Si la URL ni siquiera parsea, la tratamos como no objetivo para no romper navegacion.
    const decision = { blocked: false, reason: "not_target" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision });
    return decision;
  }
  const matchedDomain = hostname ? matchDomain(hostname, settings.blockedDomains) : null;
  if (!matchedDomain) {
    // El motor solo aplica reglas a dominios registrados explicitamente en blockedDomains.
    const decision = { blocked: false, reason: "not_target" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision });
    return decision;
  }

  if (settings.whitelistEnabled && isWhitelisted(urlString, settings.whitelist)) {
    // La whitelist siempre gana: si una URL esta permitida, no seguimos evaluando otras reglas.
    const decision = { blocked: false } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision, reason: "whitelist" });
    return decision;
  }

  const tags = getDomainTags(settings, matchedDomain);
  if (!tags.length) {
    // Dominio bloqueado sin tags es configuracion incompleta; se bloquea por seguridad.
    return { blocked: true, reason: "missing_tag" };
  }
  const hasIntervals = tags.includes("intervalos");
  const hasWeekly = tags.includes("por_semana");

  if (hasIntervals) {
    // `intervalos` mezcla horario, bloqueos especiales y bloqueo manual en ese orden de prioridad.
    devLog("blocking.evaluate", { url: urlString, note: "intervals_check", blockEnabled: settings.blockEnabled });
    if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
      // El desbloqueo temporal anula el resto de reglas del flujo `intervalos` mientras siga vigente.
      const decision = { blocked: false } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision, reason: "temporary_unblock" });
      return decision;
    }

    if (settings.blockKids && isKidsDomain(urlString)) {
      const decision = { blocked: true, reason: "kids" } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision });
      return decision;
    }

    if (settings.blockShorts && isShortsUrl(urlString)) {
      const decision = { blocked: true, reason: "shorts" } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision });
      return decision;
    }

    if (settings.blockInstagramReels && isInstagramReelsUrl(urlString)) {
      const decision = { blocked: true, reason: "manual" } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision, note: "instagram_reels" });
      return decision;
    }

    if (isWithinBlockedSchedule(new Date(now), settings.intervalsByDay)) {
      // El horario bloqueado domina sobre el fallback manual de este mismo dominio.
      const decision = { blocked: true, reason: "schedule" } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision });
      return decision;
    }

    if (settings.blockEnabled) {
      // Fuera del horario, `blockEnabled` mantiene el dominio bloqueado como red de seguridad.
      const decision = { blocked: true, reason: "manual" } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision, note: "block_enabled_intervalos" });
      return decision;
    }

    const decision = { blocked: false } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision, reason: "intervals_free" });
    return decision;
  }

  if (hasWeekly) {
    // `por_semana` se comporta como bloqueo permanente salvo durante la sesion semanal habilitada.
    if (settings.weeklyUnblockEnabled && isWeeklySessionActive(settings, now)) {
      // Si la sesion semanal esta activa, liberamos completamente la URL hasta su vencimiento.
      const decision = { blocked: false } as const;
      devLog("blocking.evaluate", { url: urlString, ...decision, reason: "weekly_unblock" });
      return decision;
    }
    const decision = { blocked: true, reason: "manual" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision, note: "weekly_tag" });
    return decision;
  }

  if (!settings.strictMode && settings.unblockUntil && now < settings.unblockUntil) {
    // Este desbloqueo temporal cubre dominios sin tags especiales, salvo que strictMode lo invalide.
    const decision = { blocked: false } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision, reason: "temporary_unblock" });
    return decision;
  }

  if (settings.blockEnabled) {
    const decision = { blocked: true, reason: "manual" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision, note: "block_enabled" });
    return decision;
  }

  if (settings.blockKids && isKidsDomain(urlString)) {
    const decision = { blocked: true, reason: "kids" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision });
    return decision;
  }

  if (settings.blockShorts && isShortsUrl(urlString)) {
    const decision = { blocked: true, reason: "shorts" } as const;
    devLog("blocking.evaluate", { url: urlString, ...decision });
    return decision;
  }

  const decision = { blocked: false } as const;
  devLog("blocking.evaluate", { url: urlString, ...decision, reason: "no_rule" });
  return decision;
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
