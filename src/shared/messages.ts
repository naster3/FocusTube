import { devWarn } from "./devLogger";

export type OutgoingMessageType =
  | "CHECK_BLOCK"
  | "GET_TIMELINE"
  | "PAGE_HELLO"
  | "VISIBILITY_CHANGED"
  | "BLOCKED_PAGE_TICK"
  | "GET_LAST_ATTEMPT"
  | "CLOSE_ACTIVE_TAB"
  | "METRICS_GET"
  | "METRICS_RESET";

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object";
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidOutgoingMessage(message: unknown, context?: string) {
  const prefix = context ? `[${context}]` : "";
  if (!isRecord(message)) {
    devWarn(prefix, "Invalid message: not an object");
    return false;
  }
  const type = message.type;
  if (!isString(type)) {
    devWarn(prefix, "Invalid message: missing type");
    return false;
  }

  switch (type as OutgoingMessageType) {
    case "CHECK_BLOCK":
      if (!isString(message.url)) {
        devWarn(prefix, "Invalid CHECK_BLOCK: url must be string");
        return false;
      }
      return true;
    case "GET_TIMELINE":
      return true;
    case "PAGE_HELLO":
      if (!isString(message.url)) {
        devWarn(prefix, "Invalid PAGE_HELLO: url must be string");
        return false;
      }
      if (typeof message.visible !== "undefined" && !isBoolean(message.visible)) {
        devWarn(prefix, "Invalid PAGE_HELLO: visible must be boolean");
        return false;
      }
      return true;
    case "VISIBILITY_CHANGED":
      if (!isBoolean(message.visible)) {
        devWarn(prefix, "Invalid VISIBILITY_CHANGED: visible must be boolean");
        return false;
      }
      return true;
    case "BLOCKED_PAGE_TICK":
      if (!isNumber(message.deltaSec)) {
        devWarn(prefix, "Invalid BLOCKED_PAGE_TICK: deltaSec must be number");
        return false;
      }
      return true;
    case "GET_LAST_ATTEMPT":
      if (!isNumber(message.tabId)) {
        devWarn(prefix, "Invalid GET_LAST_ATTEMPT: tabId must be number");
        return false;
      }
      return true;
    case "CLOSE_ACTIVE_TAB":
      if (typeof message.tabId !== "undefined" && !isNumber(message.tabId)) {
        devWarn(prefix, "Invalid CLOSE_ACTIVE_TAB: tabId must be number");
        return false;
      }
      return true;
    case "METRICS_GET":
    case "METRICS_RESET":
      return true;
    default:
      devWarn(prefix, "Invalid message: unknown type", type);
      return false;
  }
}
