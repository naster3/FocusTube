import { test } from "@playwright/test";

const viewports: Record<string, { width: number; height: number }> = {
  popup: { width: 420, height: 720 },
  dashboard: { width: 1440, height: 1200 },
  blocked: { width: 1280, height: 960 },
  options: { width: 1440, height: 1200 }
};

const pages = [
  { key: "popup", url: "/src/ui/popup/index.html" },
  { key: "dashboard", url: "/src/ui/dashboard/index.html" },
  {
    key: "blocked",
    url: "/src/ui/blocked/index.html?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc"
  },
  { key: "options", url: "/src/ui/options/index.html" }
] as const;

test.describe("visual snapshots @visual", () => {
  for (const entry of pages) {
    test(`capture ${entry.key}`, async ({ page }) => {
      const viewport = viewports[entry.key];
      await page.setViewportSize(viewport);

      await page.addInitScript(() => {
        Math.random = () => 0;
      });

      if (entry.key === "blocked") {
        await page.addInitScript(() => {
          const nextSettings = {
            blockedDomains: ["youtube.com"],
            blockedDomainTags: { "youtube.com": ["intervalos"] }
          };
          window.localStorage.setItem("focustube:settings", JSON.stringify(nextSettings));
        });
      }

      await page.goto(entry.url);

      await page.addStyleTag({
        content: `
          *,
          *::before,
          *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `
      });

      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(150);
      await page.screenshot({
        path: `test-results/visual/${entry.key}.png`,
        fullPage: true
      });
    });
  }
});
