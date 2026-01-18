import { ensureBlockingGuard } from "./blockingGuard";
import { safeSendMessage } from "./extensionMessaging";
import { allowWhitelistedYouTubeWatchIfPossible, isYouTubeWatchUrl } from "./youtubeWhitelist";

// Consulta bloqueo y redirige a blocked.html si aplica.
export async function checkAndBlock() {
  const url = window.location.href;
  const guard = ensureBlockingGuard();

  // Muestra guard de inmediato para evitar flash.
  guard.show("Verificando reglasƒ?İ");

  // Atajo: permitir /watch si el canal esta en whitelist.
  if (isYouTubeWatchUrl(url)) {
    try {
      const allowed = await allowWhitelistedYouTubeWatchIfPossible((label) => guard.setLabel(label));
      if (allowed) {
        guard.hide();
        return;
      }
    } catch {
      // Si algo falla, seguimos con el flujo normal de bloqueo.
    }
    guard.setLabel("Verificando reglasƒ?İ");
  }

  // Fail-open si el background no responde rapido.
  let settled = false;
  const failOpen = window.setTimeout(() => {
    if (settled) return;
    guard.hide();
  }, 2000);

  // Consulta al background para la decision final.
  safeSendMessage<{ blocked: boolean } & Record<string, unknown>>({ type: "CHECK_BLOCK", url }, (response) => {
    settled = true;
    window.clearTimeout(failOpen);

    if (!response?.blocked) {
      guard.hide();
      return;
    }

    // Redirecciona a pagina de bloqueo.
    guard.setLabel("Bloqueado. Redirigiendoƒ?İ");
    const blockedUrl = `${chrome.runtime.getURL("blocked.html")}?url=${encodeURIComponent(url)}`;
    window.location.replace(blockedUrl);
  });
}
