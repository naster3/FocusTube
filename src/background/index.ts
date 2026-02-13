import { startBackgroundTasks } from "./backgroundTasks";
import { registerLifecycleListeners } from "./lifecycle";
import { registerMessageListener } from "./messaging";
import { primeActiveTabState, registerTabListeners } from "./tabs";
import { registerFocusTimer } from "./focusTimer";

// Entrypoint del service worker: registra listeners.
registerLifecycleListeners();
registerTabListeners();
registerMessageListener();
registerFocusTimer();
startBackgroundTasks();
void primeActiveTabState();
