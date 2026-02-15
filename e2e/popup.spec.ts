import { expect, test } from "@playwright/test";

test("popup carga y cambia entre tabs", async ({ page }) => {
  await page.goto("/src/ui/popup/index.html");

  await expect(page.locator(".popup")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FocusTube" })).toBeVisible();

  const tabs = page.locator(".popup-tab");
  await expect(tabs).toHaveCount(2);
  await tabs.nth(1).click();

  await expect(page.locator(".focus-card")).toBeVisible();
});
