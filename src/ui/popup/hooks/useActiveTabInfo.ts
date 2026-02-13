import { useEffect, useState } from "react";
import { devLog } from "../../../shared/devLogger";

type ActiveTabInfo = {
  tabUrl: string | null;
  isIncognitoTab: boolean;
  incognitoAllowed: boolean | null;
};

export function useActiveTabInfo(): ActiveTabInfo {
  const [tabUrl, setTabUrl] = useState<string | null>(null);
  const [isIncognitoTab, setIsIncognitoTab] = useState(false);
  const [incognitoAllowed, setIncognitoAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) {
      devLog("chrome.tabs.query not available; popup dev view has no active tab.");
      setTabUrl(null);
      setIsIncognitoTab(false);
      return;
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setTabUrl(tabs[0]?.url || null);
      setIsIncognitoTab(Boolean(tabs[0]?.incognito));
    });
  }, []);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.extension?.isAllowedIncognitoAccess) {
      setIncognitoAllowed(null);
      return;
    }
    chrome.extension.isAllowedIncognitoAccess((allowed) => {
      setIncognitoAllowed(Boolean(allowed));
    });
  }, []);

  return { tabUrl, isIncognitoTab, incognitoAllowed };
}
