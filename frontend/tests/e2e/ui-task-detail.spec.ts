import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectArrayResponse, expectNoHorizontalOverflow, expectPageContains } from "./helpers/assertions";
import { apiURL, authHeaders, loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

async function firstTaskId(request: APIRequestContext, token: string, projectId: number) {
  const response = await request.get(`${apiURL}/tasks/project/${projectId}?view=board`, {
    headers: authHeaders(token),
  });
  const tasks = (await expectArrayResponse(response, "GET /tasks/project/{project_id}")) as Array<{ id: number; title: string }>;
  return tasks[0]?.id as number | undefined;
}

test.describe("UI - task detail", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("incarca pagina de detaliu pentru task", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const taskId = await firstTaskId(request, session.token, session.project!.id);
    test.skip(!taskId, "Proiectul de test nu are task-uri.");

    await page.goto(`/dashboard/tasks/${taskId}`);
    await expectPageContains(page, /Issue Definition|Properties|Audit Log/i);
    await expectNoHorizontalOverflow(page);
  });

  test("afiseaza zona de comentarii pe task detail", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const taskId = await firstTaskId(request, session.token, session.project!.id);
    test.skip(!taskId, "Proiectul de test nu are task-uri.");

    await page.goto(`/dashboard/tasks/${taskId}`);
    await expectPageContains(page, /Comments|comment|Write/i);
  });

  test("afiseaza subtasks si progress pe task detail", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const taskId = await firstTaskId(request, session.token, session.project!.id);
    test.skip(!taskId, "Proiectul de test nu are task-uri.");

    await page.goto(`/dashboard/tasks/${taskId}`);
    await expectPageContains(page, /Subtasks|Checklist|progress|complete/i);
  });

  test("campurile de proprietati sunt accesibile vizual", async ({ page, request }) => {
    const session = await loginPageViaApi(page, request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const taskId = await firstTaskId(request, session.token, session.project!.id);
    test.skip(!taskId, "Proiectul de test nu are task-uri.");

    await page.goto(`/dashboard/tasks/${taskId}`);
    await expect(page.locator("select, button, input").first()).toBeVisible();
    await expectPageContains(page, /Status|Priority|Assignee|Target Date/i);
  });
});
