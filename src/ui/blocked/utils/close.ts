import { isValidOutgoingMessage } from "../../../shared/messages";

export async function closeBlockedTab() {
  try {
    window.close();
  } catch {
    // ignore
  }
  try {
    const currentTab = await chrome.tabs.getCurrent();
    const tabId = currentTab?.id;
    if (tabId) {
      await chrome.tabs.remove(tabId);
      return;
    }
  } catch {
    // ignore
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs?.[0]?.id;
    if (tabId) {
      await chrome.tabs.remove(tabId);
      return;
    }
  } catch {
    // ignore
  }
  try {
    const message = { type: "CLOSE_ACTIVE_TAB" };
    if (!isValidOutgoingMessage(message, "blocked")) {
      return;
    }
    await chrome.runtime.sendMessage(message);
  } catch {
    // ignore
  }
}
