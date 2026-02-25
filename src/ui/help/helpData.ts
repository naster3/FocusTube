import { t } from "../../shared/i18n";
import type { Settings } from "../../domain/settings/types";
import type { HelpGroup } from "./types";

export const buildHelpGroups = (language: Settings["language"]): HelpGroup[] => [
  {
    id: "setup",
    title: t(language, "help.section.setup"),
    items: [
      {
        id: "guide",
        title: t(language, "help.guide.title"),
        lines: [t(language, "help.guide.line1"), t(language, "help.guide.line2"), t(language, "help.guide.line3")],
      },
      {
        id: "schedule",
        title: t(language, "help.schedule.title"),
        lines: [
          t(language, "help.schedule.line1"),
          t(language, "help.schedule.line2"),
          t(language, "help.schedule.line3"),
          t(language, "help.schedule.line4"),
          t(language, "help.schedule.line5"),
          t(language, "help.schedule.line6"),
        ],
      },
      {
        id: "weekly",
        title: t(language, "help.weekly.title"),
        lines: [t(language, "help.weekly.line1"), t(language, "help.weekly.line2"), t(language, "help.weekly.line3")],
      },
      {
        id: "strict",
        title: t(language, "help.strict.title"),
        lines: [t(language, "help.strict.line1"), t(language, "help.strict.line2"), t(language, "help.strict.line3")],
      },
      {
        id: "temp",
        title: t(language, "help.temp_unblock.title"),
        lines: [
          t(language, "help.temp_unblock.line1"),
          t(language, "help.temp_unblock.line2"),
          t(language, "help.temp_unblock.line3"),
        ],
      },
      {
        id: "theme",
        title: t(language, "help.theme.title"),
        lines: [t(language, "help.theme.line1"), t(language, "help.theme.line2"), t(language, "help.theme.line3")],
      },
      {
        id: "focus",
        title: t(language, "help.focus.title"),
        lines: [t(language, "help.focus.line1"), t(language, "help.focus.line2"), t(language, "help.focus.line3")],
      },
      {
        id: "notifications",
        title: t(language, "help.notifications.title"),
        lines: [t(language, "help.notifications.line1"), t(language, "help.notifications.line2")],
      },
    ],
  },
  {
    id: "blocking",
    title: t(language, "help.section.blocking"),
    items: [
      {
        id: "manual",
        title: t(language, "help.manual.title"),
        lines: [
          t(language, "help.manual.line1"),
          t(language, "help.manual.line2"),
          t(language, "help.manual.line3"),
          t(language, "help.manual.line4"),
        ],
      },
      {
        id: "tags",
        title: t(language, "help.tags.title"),
        lines: [t(language, "help.tags.line1"), t(language, "help.tags.line2"), t(language, "help.tags.line3")],
      },
      {
        id: "reasons",
        title: t(language, "help.reasons.title"),
        lines: [
          t(language, "help.reasons.line1"),
          t(language, "help.reasons.line2"),
          t(language, "help.reasons.line3"),
        ],
      },
      {
        id: "carryover",
        title: t(language, "help.carryover.title"),
        lines: [t(language, "help.carryover.line1"), t(language, "help.carryover.line2")],
      },
      {
        id: "quick_blocks",
        title: t(language, "help.quick_blocks.title"),
        lines: [
          t(language, "help.quick_blocks.line1"),
          t(language, "help.quick_blocks.line2"),
          t(language, "help.quick_blocks.line3"),
        ],
      },
      {
        id: "permissions",
        title: t(language, "help.permissions.title"),
        lines: [
          t(language, "help.permissions.line1"),
          t(language, "help.permissions.line2"),
          t(language, "help.permissions.line3"),
          t(language, "help.permissions.line4"),
        ],
      },
      {
        id: "whitelist",
        title: t(language, "help.whitelist.title"),
        lines: [
          t(language, "help.whitelist.line1"),
          t(language, "help.whitelist.line2"),
          t(language, "help.whitelist.line3"),
        ],
      },
      {
        id: "blocked_page",
        title: t(language, "help.blocked_page.title"),
        lines: [
          t(language, "help.blocked_page.line1"),
          t(language, "help.blocked_page.line2"),
          t(language, "help.blocked_page.line3"),
        ],
      },
      {
        id: "incognito",
        title: t(language, "help.incognito.title"),
        lines: [t(language, "help.incognito.line1"), t(language, "help.incognito.line2")],
      },
    ],
  },
  {
    id: "data",
    title: t(language, "help.section.data"),
    items: [
      {
        id: "export_formats",
        title: t(language, "help.export_formats.title"),
        lines: [
          t(language, "help.export_formats.line1"),
          t(language, "help.export_formats.line2"),
          t(language, "help.export_formats.line3"),
        ],
      },
      {
        id: "import_export",
        title: t(language, "help.import_export.title"),
        lines: [
          t(language, "help.import_export.line1"),
          t(language, "help.import_export.line2"),
          t(language, "help.import_export.line3"),
        ],
      },
      {
        id: "reset",
        title: t(language, "help.reset.title"),
        lines: [
          t(language, "help.reset.line1"),
          t(language, "help.reset.line2"),
          t(language, "help.reset.line3"),
          t(language, "help.reset.line4"),
        ],
        note: t(language, "help.reset.note"),
        code: "chrome.storage.local.clear()",
      },
      {
        id: "metrics",
        title: t(language, "dashboard.metrics.title"),
        lines: [
          t(language, "help.metrics.line1"),
          t(language, "help.metrics.line2"),
          t(language, "help.metrics.line3"),
          t(language, "help.metrics.line4"),
          t(language, "help.metrics.line5"),
        ],
      },
      {
        id: "privacy",
        title: t(language, "help.privacy.title"),
        lines: [
          t(language, "help.privacy.line1"),
          t(language, "help.privacy.line2"),
          t(language, "help.privacy.line3"),
        ],
      },
    ],
  },
  {
    id: "troubleshoot",
    title: t(language, "help.section.troubleshoot"),
    items: [
      {
        id: "troubleshoot",
        title: t(language, "help.troubleshoot.title"),
        lines: [
          t(language, "help.troubleshoot.line1"),
          t(language, "help.troubleshoot.line2"),
          t(language, "help.troubleshoot.line3"),
        ],
      },
    ],
  },
];
