import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectPageContains } from "./helpers/assertions";
import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("UI - Global Admin Console extins", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("afiseaza command center si KPI-uri", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin");
    await expectPageContains(page, /Global Admin Console|Active projects|Server errors|Open Tickets/i);
    await expectNoHorizontalOverflow(page);
  });

  test("afiseaza sectiunea Identity", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin#users");
    await expect(page.getByRole("heading", { level: 2, name: "Users" })).toBeVisible();
  });

  test("afiseaza registrul proiectelor", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin#projects");
    await expectPageContains(page, /Project Registry|Archive|Delete/i);
  });

  test("afiseaza support desk cu conversatii", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin#support");
    await expectPageContains(page, /Support Desk|Conversation|Reply|Ticket/i);
  });

  test("afiseaza AI usage si filtrele", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin#ai-usage");
    await expectPageContains(page, /AI Usage|Feature|Status|Project|Period/i);
  });

  test("afiseaza system health si inspect pentru erori", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin#errors");
    await expectPageContains(page, /Application Errors|Inspect|HTTP|GET|POST/i);
  });
});
