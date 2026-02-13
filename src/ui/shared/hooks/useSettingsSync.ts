import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../../../domain/settings/defaults";
import type { Settings } from "../../../domain/settings/types";
import { getSettings, mergeSettings, onStorageChanged } from "../../../infrastructure/storage";

export function useSettingsSync(initial: Settings = DEFAULT_SETTINGS) {
  const [settings, setSettings] = useState<Settings>(initial);

  useEffect(() => {
    void (async () => {
      const stored = await getSettings();
      setSettings(stored);
    })();
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") {
        return;
      }
      if (changes.settings) {
        const nextValue = changes.settings.newValue;
        if (nextValue && typeof nextValue === "object") {
          setSettings(mergeSettings(nextValue as Partial<Settings>));
          return;
        }
        void (async () => {
          const stored = await getSettings();
          setSettings(stored);
        })();
      }
    };
    return onStorageChanged(listener);
  }, []);

  return { settings, setSettings };
}
