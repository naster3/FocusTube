import { startBackgroundTasks } from "./backgroundTasks";
import { registerLifecycleListeners } from "./lifecycle";
import { registerMessageListener } from "./messaging";
import { primeActiveTabState, registerTabListeners } from "./tabs";

// Entrypoint del service worker: registra listeners.
registerLifecycleListeners();
registerTabListeners();
registerMessageListener();
startBackgroundTasks();
void primeActiveTabState();
