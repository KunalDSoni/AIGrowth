import { expect, test } from "@playwright/test";

test("landing to onboarding and project creation", async ({ page }) => {
  page.on("pageerror", (error) => console.error("Browser error:", error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Stop reading SEO reports/ })).toBeVisible();
  await page.getByLabel("Website URL").fill("northstaraccounting.com.au");
  await page.getByRole("button", { name: /Run free AI audit/ }).click();
  await expect(page).toHaveURL(/onboarding/);
  await page.waitForTimeout(300); // Wait for the client island to hydrate before the first interaction.

  for (let step = 2; step <= 5; step++) {
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText(`STEP ${step} OF 5`)).toBeVisible();
  }

  const startAnalysis = page.getByRole("button", { name: /Start my analysis/ });
  await expect(startAnalysis).toBeEnabled();
  await startAnalysis.click();
  await page.waitForURL(/analysis/, { timeout: 10_000 });
  await expect(page.getByText("Building your growth plan")).toBeVisible();
  await page.waitForURL(/demo\/dashboard/, { timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "What should I do next?" })).toBeVisible();
  await page.goto("/demo/audit");
  await expect(page.getByText("Latest persisted audit run")).toBeVisible();
});

test("view, generate and complete a recommendation", async ({ page }) => {
  await page.goto("/demo/dashboard");
  await expect(page.getByText("Unified intelligence engine")).toBeVisible();
  await expect(page.getByText(/no ranking guarantees/i)).toBeVisible();
  await page.getByRole("link", { name: /Generate fix/ }).click();
  await expect(page.getByRole("heading", { name: /Rewrite the homepage/ })).toBeVisible();
  await expect(page.getByText("Decision evidence")).toBeVisible();
  await expect(page.getByText("Evidence provenance")).toBeVisible();
  await expect(page.getByText(/Simulated/).first()).toBeVisible();
  await page.getByRole("button", { name: /Generate seo metadata/i }).click();
  await expect(page.getByLabel("Suggested version")).toBeVisible();
  await page.getByRole("button", { name: "Approve draft" }).click();
  await page.getByRole("button", { name: "Mark completed" }).click();
  await expect(page.getByRole("button", { name: "Completed" })).toBeVisible();
});

test("assistant and mobile navigation", async ({ page, isMobile }) => {
  await page.goto("/demo/assistant");
  await page.getByRole("button", { name: "What should I fix first?" }).click();
  await expect(page.getByText(/Fix the homepage search preview first/)).toBeVisible();
  if (isMobile) {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Audit workspace" })).toBeVisible();
  }
});

test("content planner opens an evidence-backed brief", async ({ page }) => {
  await page.goto("/demo/content");
  await expect(page.getByText("Business-aware gap engine")).toBeVisible();
  await page.getByRole("button", { name: /Generate content brief/ }).first().click();
  await expect(page.getByText("Evidence-backed brief")).toBeVisible();
  await expect(page.getByText("Evidence used")).toBeVisible();
  await expect(page.getByText(/Claims to verify/)).toBeVisible();
});

test("audit workspace shows rule evidence", async ({ page }) => {
  await page.goto("/demo/audit");
  await expect(page.getByText("Technical rules now connect each issue")).toBeVisible();
  await expect(page.getByText(/Rule: metadata.unique-title-description/)).toBeVisible();
  await expect(page.getByText(/Mock technical crawl/).first()).toBeVisible();
});

test("ai visibility shows observations and variability", async ({ page }) => {
  await page.goto("/demo/ai-visibility");
  await expect(page.getByRole("heading", { name: /How AI answers mention Northstar/ })).toBeVisible();
  await expect(page.getByText("Citation gap actions")).toBeVisible();
  await expect(page.getByText(/Turn source gaps into useful work/)).toBeVisible();
  await expect(page.getByText(/Sample size 3/).first()).toBeVisible();
  await expect(page.getByText("Brand mention frequency").first()).toBeVisible();
  await page.getByText("View observations and evidence").first().click();
  await expect(page.getByText(/Northstar mentioned/).first()).toBeVisible();
});

test("outcomes show before-and-after learning", async ({ page }) => {
  await page.goto("/demo/outcomes");
  await expect(page.getByRole("heading", { name: /What changed after implementation/ })).toBeVisible();
  await expect(page.getByText("Attribution limits:").first()).toBeVisible();
  await expect(page.getByText("Follow-up:").first()).toBeVisible();
});
