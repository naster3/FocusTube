// Evita llamadas cuando el contexto de la extension se invalida.
export function canUseExtension() {
  return Boolean(chrome?.runtime?.id);
}

// Wrapper seguro para mensajeria hacia background.
export function safeSendMessage<T>(
  message: { type: string; [key: string]: unknown },
  callback: (response: T | undefined) => void
) {
  if (!canUseExtension()) {
    return;
  }
  try {
    chrome.runtime.sendMessage(message, (response) => {
      const err = chrome.runtime.lastError;
      if (err?.message?.includes("Extension context invalidated")) {
        return;
      }
      callback(response as T | undefined);
    });
  } catch {
    // Extension context might be invalidated after reload.
  }
}

// Handshake inicial con la URL y visibilidad actual.
export function sendPageHello() {
  safeSendMessage(
    {
      type: "PAGE_HELLO",
      url: window.location.href,
      visible: document.visibilityState === "visible"
    },
    () => undefined
  );
}

// Observa cambios de visibilidad del documento.
export function trackVisibilityChanges() {
  document.addEventListener("visibilitychange", () => {
    safeSendMessage(
      {
        type: "VISIBILITY_CHANGED",
        visible: document.visibilityState === "visible"
      },
      () => undefined
    );
  });
}

// Detecta cambios de URL en SPA (YouTube) y dispara callback.
export function trackUrlChanges(onChange: () => void) {
  let lastUrl = window.location.href;
  window.setInterval(() => {
    if (!canUseExtension()) {
      return;
    }
    const current = window.location.href;
    if (current !== lastUrl) {
      lastUrl = current;
      sendPageHello();
      onChange();
    }
  }, 2000);
}
