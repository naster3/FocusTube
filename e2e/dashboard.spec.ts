import { expect, test } from "@playwright/test";

test("dashboard carga y cambia a tab de tabla de metricas", async ({ page }) => {
  await page.goto("/src/ui/dashboard/index.html");

  await expect(page.locator(".options")).toBeVisible();
  await expect(page.getByRole("heading", { name: "FocusTube Blocker" })).toBeVisible();

  const metricsTabs = page.locator(".metrics-tab");
  await expect(metricsTabs).toHaveCount(4);
  await metricsTabs.nth(2).click();

  await expect(page.locator(".table")).toBeVisible();
});
