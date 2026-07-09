import { expect, type APIResponse, type Page } from "@playwright/test";

export async function expectOkResponse(response: APIResponse, label: string) {
  expect(response.ok(), `${label}: ${await response.text()}`).toBeTruthy();
}

export async function expectStatusIn(response: APIResponse, statuses: number[], label: string) {
  expect(statuses, `${label}: status ${response.status()} - ${await response.text()}`).toContain(response.status());
}

export async function expectArrayResponse(response: APIResponse, label: string) {
  await expectOkResponse(response, label);
  const data = await response.json();
  expect(Array.isArray(data), `${label}: raspunsul trebuie sa fie lista`).toBeTruthy();
  return data as unknown[];
}

export async function expectObjectResponse(response: APIResponse, label: string) {
  await expectOkResponse(response, label);
  const data = await response.json();
  expect(data && typeof data === "object" && !Array.isArray(data), `${label}: raspunsul trebuie sa fie obiect`).toBeTruthy();
  return data as Record<string, unknown>;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 4;
  });

  expect(hasOverflow).toBeFalsy();
}

export async function expectPageContains(page: Page, text: RegExp | string) {
  await expect(page.locator("body")).toContainText(text);
}
