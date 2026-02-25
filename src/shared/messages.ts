import type { BlockDecision, Metrics } from "../domain/settings/types";
import type { ScheduleTimeline } from "../domain/schedule/timeline";
import { devWarn } from "./devLogger";

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

export type MessageRequestMap = {
  CHECK_BLOCK: { type: "CHECK_BLOCK"; url: string };
  GET_TIMELINE: { type: "GET_TIMELINE" };
  PAGE_HELLO: { type: "PAGE_HELLO"; url: string; visible?: boolean };
  VISIBILITY_CHANGED: { type: "VISIBILITY_CHANGED"; visible: boolean };
  BLOCKED_PAGE_TICK: { type: "BLOCKED_PAGE_TICK"; deltaSec: number };
  GET_LAST_ATTEMPT: { type: "GET_LAST_ATTEMPT"; tabId: number };
  CLOSE_ACTIVE_TAB: { type: "CLOSE_ACTIVE_TAB"; tabId?: number };
  METRICS_GET: { type: "METRICS_GET" };
  METRICS_RESET: { type: "METRICS_RESET" };
};

export type MessageType = keyof MessageRequestMap;

export type MessageRequest<T extends MessageType = MessageType> = MessageRequestMap[T];

type Ok<T> = { ok: true } & T;

export type MessageError = { ok: false; error: string };

export type MessageResponseMap = {
  CHECK_BLOCK: Ok<BlockDecision>;
  GET_TIMELINE: Ok<{ timeline: ScheduleTimeline }>;
  PAGE_HELLO: Ok<Record<string, never>>;
  VISIBILITY_CHANGED: Ok<Record<string, never>>;
  BLOCKED_PAGE_TICK: Ok<Record<string, never>>;
  GET_LAST_ATTEMPT: Ok<{ url: string | null; at: number | null }>;
  CLOSE_ACTIVE_TAB: Ok<Record<string, never>>;
  METRICS_GET: Ok<{ metrics: Metrics }>;
  METRICS_RESET: Ok<Record<string, never>>;
};

export type MessageResponse<T extends MessageType> = MessageResponseMap[T] | MessageError;

const messageValidators: Record<MessageType, (message: AnyRecord) => boolean> = {
  CHECK_BLOCK: (message) => isString(message.url),
  GET_TIMELINE: () => true,
  PAGE_HELLO: (message) =>
    isString(message.url) && (typeof message.visible === "undefined" || isBoolean(message.visible)),
  VISIBILITY_CHANGED: (message) => isBoolean(message.visible),
  BLOCKED_PAGE_TICK: (message) => isNumber(message.deltaSec),
  GET_LAST_ATTEMPT: (message) => isNumber(message.tabId),
  CLOSE_ACTIVE_TAB: (message) => typeof message.tabId === "undefined" || isNumber(message.tabId),
  METRICS_GET: () => true,
  METRICS_RESET: () => true,
};

export function isMessageType(value: unknown): value is MessageType {
  return isString(value) && Object.prototype.hasOwnProperty.call(messageValidators, value);
}

export function parseMessage(message: unknown, context?: string): MessageRequest | null {
  const prefix = context ? `[${context}]` : "";
  if (!isRecord(message)) {
    devWarn(prefix, "Invalid message: not an object");
    return null;
  }
  const type = message.type;
  if (!isMessageType(type)) {
    devWarn(prefix, "Invalid message: missing type");
    return null;
  }
  if (!messageValidators[type](message)) {
    devWarn(prefix, "Invalid message payload", type);
    return null;
  }
  return message as MessageRequest;
}

export function isValidOutgoingMessage(message: unknown, context?: string): message is MessageRequest {
  return Boolean(parseMessage(message, context));
}
