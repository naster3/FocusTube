import { expect, test } from "@playwright/test";

test("options carga y permite interactuar con switches", async ({ page }) => {
  await page.goto("/src/ui/options/index.html");

  await expect(page.locator(".options")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FocusTube Blocker" })).toBeVisible();

  const firstToggle = page.locator('.blocks-panel input[type="checkbox"]').first();
  const firstToggleCard = page.locator(".blocks-panel .block-card").first();
  await expect(firstToggle).toBeVisible();
  const checkedBefore = await firstToggle.isChecked();
  await firstToggleCard.click();
  await expect(firstToggle).toHaveJSProperty("checked", !checkedBefore);
});
