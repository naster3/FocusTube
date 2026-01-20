import type { Language } from "../domain/settings/types";
import { EN } from "./i18n/en";
import { ES } from "./i18n/es";
import { PT } from "./i18n/pt";
import { FR } from "./i18n/fr";

type I18nEntry = { en: string; es: string; pt: string; fr: string };

export type I18nKey = keyof typeof EN;

export const STRINGS = Object.keys(EN).reduce((acc, key) => {
  const typedKey = key as I18nKey;
  acc[typedKey] = {
    en: EN[typedKey],
    es: ES[typedKey] ?? EN[typedKey],
    pt: PT[typedKey] ?? EN[typedKey],
    fr: FR[typedKey] ?? EN[typedKey]
  };
  return acc;
}, {} as Record<I18nKey, I18nEntry>);

export function t(lang: Language, key: I18nKey): string {
  const entry = STRINGS[key];
  return entry?.[lang] ?? entry?.en ?? key;
}

export function tf(lang: Language, key: I18nKey, vars: Record<string, string>): string {
  let text = t(lang, key);
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}
