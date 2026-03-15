import type { Language } from "../../domain/settings/types";

export type DayOrder = "sunday-first" | "monday-first";

export const DAY_ORDER_SUNDAY_FIRST = [0, 1, 2, 3, 4, 5, 6] as const;
export const DAY_ORDER_MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0] as const;

const DAY_LABELS_BY_LANG: Record<Language, string[]> = {
  es: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  pt: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
  fr: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
};

const LANGUAGE_LOCALES: Record<Language, string> = {
  es: "es-ES",
  en: "en-US",
  pt: "pt-BR",
  fr: "fr-FR",
};

export const getLocale = (language: Language) => LANGUAGE_LOCALES[language] ?? LANGUAGE_LOCALES.en;

export const getDayLabels = (language: Language) => DAY_LABELS_BY_LANG[language] ?? DAY_LABELS_BY_LANG.en;

export const getDayLabel = (day: number, language: Language) => {
  const labels = getDayLabels(language);
  return labels[day] ?? String(day);
};

export const getDayLabelsInOrder = (language: Language, order: DayOrder) => {
  const labels = getDayLabels(language);
  const orderList = order === "monday-first" ? DAY_ORDER_MONDAY_FIRST : DAY_ORDER_SUNDAY_FIRST;
  return orderList.map((day) => labels[day] ?? String(day));
};

export const getDayOptions = (language: Language, order: DayOrder = "sunday-first") => {
  const labels = getDayLabels(language);
  const orderList = order === "monday-first" ? DAY_ORDER_MONDAY_FIRST : DAY_ORDER_SUNDAY_FIRST;
  return orderList.map((day) => ({ value: day, label: labels[day] ?? String(day) }));
};

export const formatDate = (language: Language, ts: number, dateStyle: "short" | "medium" | "long" = "medium") => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), { dateStyle }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleDateString();
  }
};

export const formatDateTime = (
  language: Language,
  ts: number,
  timeFormat12h: boolean,
  dateStyle: "short" | "medium" | "long" = "medium",
  timeStyle: "short" | "medium" = "short"
) => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), {
      dateStyle,
      timeStyle,
      hour12: timeFormat12h,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
};

export const formatTime = (
  language: Language,
  ts: number,
  timeFormat12h: boolean,
  timeStyle: "short" | "medium" = "short"
) => {
  try {
    return new Intl.DateTimeFormat(getLocale(language), {
      timeStyle,
      hour12: timeFormat12h,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
};

export const formatDateRange = (language: Language, start: Date, end: Date) => {
  return `${formatDate(language, start.getTime())} - ${formatDate(language, end.getTime())}`;
};
