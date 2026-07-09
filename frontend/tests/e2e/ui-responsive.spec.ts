import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./helpers/assertions";
import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("UI - responsive si navigatie", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("dashboardul nu produce overflow orizontal", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: session.project!.name })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("meniul mobil se deschide si inchide controlat", async ({ page, request }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Testul ruleaza doar pe proiectul Playwright mobil.");

    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    await page.goto("/dashboard");
    await page.getByLabel("Open navigation").click();
    await expect(page.getByLabel("Close navigation").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Tasks/i }).first()).toBeVisible();

    await page.getByLabel("Close navigation").first().click();
    await expectNoHorizontalOverflow(page);
  });

  test("pagina Tasks permite filtrare vizuala fara blocarea inputului", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    await page.goto("/dashboard/tasks");
    const search = page.getByPlaceholder(/search key|search/i).first();
    await expect(search).toBeVisible();
    await search.fill(session.project!.key.toLowerCase());

    await expect(search).toHaveValue(session.project!.key.toLowerCase());
    await expectNoHorizontalOverflow(page);
  });
});
