import { t } from "../../../shared/i18n";
import type { Language } from "../../../domain/settings/types";
import { BLOCKED_MESSAGES } from "./constants";

export function pickMessage(language: Language) {
  const index = Math.floor(Math.random() * BLOCKED_MESSAGES.length);
  return t(language, BLOCKED_MESSAGES[index]);
}
