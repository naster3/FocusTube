import { registerLifecycleListeners } from "./lifecycle";
import { registerMessageListener } from "./messaging";
import { registerTabListeners } from "./tabs";

// Entrypoint del service worker: registra listeners.
registerLifecycleListeners();
registerTabListeners();
registerMessageListener();
