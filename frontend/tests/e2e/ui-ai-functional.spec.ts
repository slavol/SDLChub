import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectPageContains } from "./helpers/assertions";
import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("UI - functionalitati asistate de AI", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("modalul Create Issue expune generare, rafinare si estimare AI", async ({ page, request }) => {
    await loginPageViaApi(page, request);

    await page.goto("/dashboard/tasks");
    await page.getByRole("button", { name: /create issue/i }).first().click();

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Generate with AI|Refine spec/i);
    await expect(dialog).toContainText(/Estimate/i);
    await expect(dialog).toContainText(/Title/i);
    await expectNoHorizontalOverflow(page);
  });

  test("Workload Balancer afiseaza zona AI si actiunea de generare sugestii", async ({ page, request }) => {
    await loginPageViaApi(page, request);

    await page.goto("/dashboard/workload");

    await expectPageContains(page, /AI workload desk|Generate suggestions|Team capacity/i);
    await expect(page.getByRole("button", { name: /generate suggestions/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("setarile proiectului includ provider AI local si testarea conexiunii", async ({ page, request }) => {
    await loginPageViaApi(page, request);

    await page.goto("/dashboard/settings");

    await expectPageContains(page, /Project AI provider|AI mode|Platform AI key|Test provider|Save AI settings/i);
    await expect(page.getByRole("button", { name: /test provider/i }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("rapoartele si backlog-ul expun fluxul de Release Notes asistat de AI", async ({ page, request }) => {
    await loginPageViaApi(page, request);

    await page.goto("/dashboard/reports");
    await expectPageContains(page, /Release Notes|Delivery reports/i);
    await expectNoHorizontalOverflow(page);

    await page.goto("/dashboard/backlog");
    await expectPageContains(page, /Release Notes|Sprint Planning|Backlog/i);
    await expectNoHorizontalOverflow(page);
  });

  test("documentatia arata fluxul de generare automata din taskuri finalizate", async ({ page, request }) => {
    await loginPageViaApi(page, request);

    await page.goto("/dashboard/documentation");

    await expectPageContains(page, /Documentation|Wiki|Generate|New documentation/i);
    await expectNoHorizontalOverflow(page);
  });
});
