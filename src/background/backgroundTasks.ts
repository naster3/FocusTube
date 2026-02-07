// Scheduler de tareas de background para tracking periodico de metricas.
import { FLUSH_MS, TICK_MS, flushMetrics, tickMetrics } from "./metrics";
import { isBackgroundStarted, setBackgroundStarted } from "./state";

// Inicia timers de tracking una sola vez.
export function startBackgroundTasks() {
  if (isBackgroundStarted()) {
    return;
  }
  setBackgroundStarted(true);
  setInterval(() => {
    void tickMetrics();
  }, TICK_MS);
  setInterval(() => {
    void flushMetrics();
  }, FLUSH_MS);
}
