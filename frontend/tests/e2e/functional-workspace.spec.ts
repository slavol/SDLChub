import { expect, test } from "@playwright/test";

import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("Functional - fluxuri principale workspace", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("incarca dashboardul si navigheaza prin ariile principale", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1, name: session.project!.name })).toBeVisible();

    const routes = [
      { path: "/dashboard/tasks", text: /Task filters|Tasks for/i },
      { path: "/dashboard/calendar", text: /Month|Week|Agenda|Calendar/i },
      { path: "/dashboard/activity", text: /Activity Center|Timeline/i },
      { path: "/dashboard/team", text: /Team management|Team hierarchy/i },
      { path: "/dashboard/settings", text: /Project settings|Settings unavailable/i },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator("body")).toContainText(route.text);
    }
  });

  test("pagina de login afiseaza eroare fara refresh distructiv", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("john@example.com").fill("wrong@example.com");
    await page.locator("input[type='password']").fill("wrong-password");
    await page.getByRole("button", { name: /login|sign in/i }).click();

    await expect(page.locator("body")).toContainText(/invalid|incorrect|credential|parola|email|eroare/i);
    await expect(page).toHaveURL(/\/login/);
  });
});
