import { ProfileId, ProfileSettings, Settings } from "./types";

export const PROFILE_FIELDS: (keyof ProfileSettings)[] = [
  "blockEnabled",
  "blockShorts",
  "blockKids",
  "blockInstagramReels",
  "blockedDomains",
  "blockedDomainTags",
  "whitelist",
  "whitelistEnabled",
  "schedules",
  "intervalsByDay",
  "timeFormat12h",
  "unblockUntil",
  "weeklyUnblockEnabled",
  "weeklyUnblockDays",
  "weeklyUnblockDurationMinutes",
  "weeklyUnblockUntil",
  "weeklyUnblockLastWeek",
];

export const extractProfile = (settings: Settings): ProfileSettings => ({
  blockEnabled: settings.blockEnabled,
  blockShorts: settings.blockShorts,
  blockKids: settings.blockKids,
  blockInstagramReels: settings.blockInstagramReels,
  blockedDomains: settings.blockedDomains,
  blockedDomainTags: settings.blockedDomainTags,
  whitelist: settings.whitelist,
  whitelistEnabled: settings.whitelistEnabled,
  schedules: settings.schedules,
  intervalsByDay: settings.intervalsByDay,
  timeFormat12h: settings.timeFormat12h,
  unblockUntil: settings.unblockUntil,
  weeklyUnblockEnabled: settings.weeklyUnblockEnabled,
  weeklyUnblockDays: settings.weeklyUnblockDays,
  weeklyUnblockDurationMinutes: settings.weeklyUnblockDurationMinutes,
  weeklyUnblockUntil: settings.weeklyUnblockUntil,
  weeklyUnblockLastWeek: settings.weeklyUnblockLastWeek,
});

export const applyProfile = (settings: Settings, profile: ProfileSettings): Settings => ({
  ...settings,
  ...profile,
});

export const syncProfiles = (settings: Settings): Settings => {
  const profile = extractProfile(settings);
  return {
    ...settings,
    profiles: {
      ...settings.profiles,
      [settings.activeProfile]: profile,
    },
  };
};

export const switchProfile = (settings: Settings, profileId: ProfileId): Settings => {
  const synced = syncProfiles(settings);
  const nextProfile = synced.profiles[profileId];
  return {
    ...synced,
    ...nextProfile,
    activeProfile: profileId,
  };
};
