import { useEffect, useState } from "react";
import { devLog } from "../../../shared/devLogger";

const getDomainOrigins = (domain: string) => [`*://${domain}/*`, `*://*.${domain}/*`];

export function useDomainPermissions(domains: string[]) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const requestPermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) {
      devLog("chrome.permissions.request not available; skipping permission prompt (dev only).");
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      chrome.permissions.request({ origins: getDomainOrigins(domain) }, (granted) => {
        resolve(Boolean(granted));
      });
    });
  };

  const removePermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.remove) {
      devLog("chrome.permissions.remove not available; skipping permission cleanup (dev only).");
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      chrome.permissions.remove({ origins: getDomainOrigins(domain) }, () => resolve());
    });
  };

  const readPermission = (domain: string) => {
    if (typeof chrome === "undefined" || !chrome.permissions?.contains) {
      devLog("chrome.permissions.contains not available; assuming granted (dev only).");
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      chrome.permissions.contains({ origins: getDomainOrigins(domain) }, (granted) => resolve(Boolean(granted)));
    });
  };

  useEffect(() => {
    let cancelled = false;
    const refreshPermissions = async () => {
      if (domains.length === 0) {
        setPermissions({});
        return;
      }
      // El dashboard muestra el estado real del permiso opcional para cada dominio configurado.
      const entries = await Promise.all(domains.map(async (domain) => [domain, await readPermission(domain)] as const));
      if (!cancelled) {
        setPermissions(Object.fromEntries(entries));
      }
    };
    void refreshPermissions();
    return () => {
      cancelled = true;
    };
  }, [domains]);

  return { permissions, requestPermission, removePermission };
}
