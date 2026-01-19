import { checkAndBlock } from "./blocker";
import { canUseExtension, sendPageHello, trackUrlChanges, trackVisibilityChanges } from "./extensionMessaging";
import { initFloatingTimerOverlay } from "./overlay";
import { initUnblockExpiryWatcher } from "./unblockTimer";

// Boot principal del content script.
checkAndBlock();
sendPageHello();
trackVisibilityChanges();
// Revalida bloqueo en navegacion SPA.
trackUrlChanges(() => {
  void checkAndBlock();
});
// Inicia el overlay flotante con countdown.
initFloatingTimerOverlay();
// Reevalua bloqueo cuando vence el desbloqueo temporal.
void initUnblockExpiryWatcher(() => {
  void checkAndBlock();
});
// Revalida bloqueo periodicamente para cambios de horario.
window.setInterval(() => {
  if (!canUseExtension()) {
    return;
  }
  void checkAndBlock({ showGuard: false });
}, 30000);

// Revalida bloqueo cuando cambian settings en storage.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.settings || !canUseExtension()) {
    return;
  }
  checkAndBlock();
});
