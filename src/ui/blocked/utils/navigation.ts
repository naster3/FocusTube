export function navigateTo(url: string) {
  if (!url) {
    return;
  }

  // jsdom does not implement full navigation and emits stderr noise in tests.
  if (typeof navigator !== "undefined" && /\bjsdom\b/i.test(navigator.userAgent)) {
    try {
      window.history.replaceState({}, "", url);
    } catch {
      // ignore
    }
    return;
  }

  window.location.href = url;
}
