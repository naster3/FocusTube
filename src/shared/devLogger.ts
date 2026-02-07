const DEV = import.meta.env.DEV;
const PREFIX = "[FocusTube][DEV]";

export function devLog(...args: unknown[]) {
  if (!DEV) return;
  console.log(PREFIX, ...args);
}

export function devWarn(...args: unknown[]) {
  if (!DEV) return;
  console.warn(PREFIX, ...args);
}

export function devError(...args: unknown[]) {
  if (!DEV) return;
  console.error(PREFIX, ...args);
}
