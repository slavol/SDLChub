import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectPageContains } from "./helpers/assertions";

const publicPages = [
  { path: "/", label: "landing page", text: /SDLC Hub|AI|workspace|project/i },
  { path: "/login", label: "login", text: /Sign In|credentials|SDLC Hub/i },
  { path: "/register", label: "register", text: /Sign up|Create|account|Register/i },
  { path: "/forgot-password", label: "forgot password", text: /reset|password|email/i },
  { path: "/verify-email", label: "verify email", text: /verify|email|token|verification/i },
  { path: "/reset-password", label: "reset password", text: /reset|password|token|invalid link/i },
];

test.describe("UI - pagini publice si autentificare", () => {
  for (const item of publicPages) {
    test(`incarca ${item.label}`, async ({ page }) => {
      await page.goto(item.path);
      await expectPageContains(page, item.text);
      await expectNoHorizontalOverflow(page);
    });
  }

  test("formularul de login permite completare fara blocaj vizual", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("john@example.com").fill("wrong@example.com");
    await page.locator("input[type='password']").fill("wrong-password");

    await expect(page.getByPlaceholder("john@example.com")).toHaveValue("wrong@example.com");
    await expect(page.locator("input[type='password']")).toHaveValue("wrong-password");
  });

  test("formularul de register expune campurile principale", async ({ page }) => {
    await page.goto("/register");

    await expect(page.locator("input").first()).toBeVisible();
    await expectPageContains(page, /email|password|name|account/i);
    await expectNoHorizontalOverflow(page);
  });
});
