import { expect, test } from "@playwright/test";

import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("Functional - Global Admin", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("global admin poate deschide consola si sectiunile principale", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1, name: "Global Admin Console" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Users" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Project Registry" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Support Desk" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Application Errors" })).toBeVisible();
  });
});
