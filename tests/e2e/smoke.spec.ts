import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("빈 애플리케이션 셸이 열리고 중대 접근성 위반이 없다", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Stock2" })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    ({ impact }) => impact === "serious" || impact === "critical",
  );
  expect(seriousViolations).toEqual([]);
});
