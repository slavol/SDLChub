import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectArrayResponse, expectObjectResponse } from "./helpers/assertions";
import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials } from "./helpers/auth";

async function loadProjectTasks(request: APIRequestContext, token: string, projectId: number) {
  const response = await request.get(`${apiURL}/tasks/project/${projectId}?view=board`, {
    headers: authHeaders(token),
  });

  return (await expectArrayResponse(response, "GET /tasks/project/{project_id}")) as Array<{
    id: number;
    key: string;
    title: string;
  }>;
}

test.describe("API - task-uri, sprinturi, calendar si documentatie", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("incarca task-urile pentru board", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    await loadProjectTasks(request, session.token, session.project!.id);
  });

  test("incarca task-urile pentru backlog", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/tasks/project/${session.project!.id}?view=backlog`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /tasks/project/{project_id}?view=backlog");
  });

  test("incarca detaliul primului task disponibil", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const tasks = await loadProjectTasks(request, session.token, session.project!.id);
    test.skip(tasks.length === 0, "Proiectul de test nu are task-uri.");

    const response = await request.get(`${apiURL}/tasks/${tasks[0].id}`, {
      headers: authHeaders(session.token),
    });
    const task = await expectObjectResponse(response, "GET /tasks/{task_id}");

    expect(task.id).toBe(tasks[0].id);
  });

  test("incarca audit log-ul primului task disponibil", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const tasks = await loadProjectTasks(request, session.token, session.project!.id);
    test.skip(tasks.length === 0, "Proiectul de test nu are task-uri.");

    const response = await request.get(`${apiURL}/tasks/${tasks[0].id}/audit`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /tasks/{task_id}/audit");
  });

  test("incarca activitatea proiectului din task engine", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/tasks/project/${session.project!.id}/activity?limit=50`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /tasks/project/{project_id}/activity");
  });

  test("incarca sprinturile proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/sprints/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /sprints/project/{project_id}");
  });

  test("incarca evenimentele de calendar", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/calendar/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /calendar/project/{project_id}");
  });

  test("incarca disponibilitatea membrilor din calendar", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/calendar/project/${session.project!.id}/availability`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /calendar/project/{project_id}/availability");
  });

  test("incarca paginile de documentatie", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/documentation/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /documentation/project/{project_id}");
  });

  test("incarca istoricul primei pagini de documentatie daca exista", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const pagesResponse = await request.get(`${apiURL}/documentation/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    const pages = (await expectArrayResponse(pagesResponse, "GET /documentation/project/{project_id}")) as Array<{ id: number }>;
    test.skip(pages.length === 0, "Proiectul de test nu are pagini de documentatie.");

    const response = await request.get(`${apiURL}/documentation/${pages[0].id}/history`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /documentation/{page_id}/history");
  });

  test("incarca echipele proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/teams/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /teams/project/{project_id}");
  });

  test("incarca feed-ul global de activity al proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/activity/project/${session.project!.id}?limit=80`, {
      headers: authHeaders(session.token),
    });
    const payload = await expectObjectResponse(response, "GET /activity/project/{project_id}");

    expect(Array.isArray(payload.items)).toBeTruthy();
    expect(payload.summary).toBeTruthy();
  });
});
