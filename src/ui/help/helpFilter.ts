import type { HelpGroup } from "./types";

export const filterHelpGroups = (groups: HelpGroup[], query: string) => {
  const queryValue = query.trim().toLowerCase();
  const filteredGroups = groups
    .map((group) => {
      if (!queryValue) {
        return group;
      }
      const items = group.items.filter((item) => {
        const haystack = [item.title, ...(item.lines || []), item.note || ""].join(" ").toLowerCase();
        return haystack.includes(queryValue);
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
  return { queryValue, filteredGroups };
};
