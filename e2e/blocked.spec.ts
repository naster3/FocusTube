import { expect, test } from "@playwright/test";

test("blocked carga y muestra confirmacion de desbloqueo", async ({ page }) => {
  await page.addInitScript(() => {
    const nextSettings = {
      blockedDomains: ["youtube.com"],
      blockedDomainTags: { "youtube.com": ["intervalos"] }
    };
    window.localStorage.setItem("focustube:settings", JSON.stringify(nextSettings));
  });

  await page.goto("/src/ui/blocked/index.html?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dabc");

  const unblockBtn = page.locator("#unblock-btn");
  await expect(unblockBtn).toBeVisible();
  await expect(unblockBtn).toBeEnabled();

  await unblockBtn.click();
  await expect(page.locator("#confirm-modal[data-open='true']")).toBeVisible();

  await page.locator("#confirm-cancel").click();
  await expect(page.locator("#confirm-modal[data-open='true']")).toHaveCount(0);
});
