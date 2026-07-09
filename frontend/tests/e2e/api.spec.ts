import { expect, test } from "@playwright/test";

import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("API - autentificare si workspace", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("respinge accesul anonim pe endpoint protejat", async ({ request }) => {
    const response = await request.get(`${apiURL}/projects/mine`);

    expect([401, 403]).toContain(response.status());
  });

  test("autentifica utilizatorul si incarca proiectele", async ({ request }) => {
    const session = await loginViaApi(request);

    expect(session.token).toBeTruthy();
    expect(session.user.email).toContain("@");
    expect(Array.isArray(session.projects)).toBeTruthy();
  });

  test("valideaza endpointurile principale pentru proiect", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const headers = authHeaders(session.token);
    const projectId = session.project!.id;

    const dashboardResponse = await request.get(`${apiURL}/projects/${projectId}/dashboard`, {
      headers,
    });
    expect(dashboardResponse.ok(), await dashboardResponse.text()).toBeTruthy();
    const dashboard = await dashboardResponse.json();
    expect(dashboard.project.id).toBe(projectId);
    expect(dashboard.metrics).toBeTruthy();

    const tasksResponse = await request.get(`${apiURL}/tasks/project/${projectId}`, {
      headers,
      params: { view: "board" },
    });
    expect(tasksResponse.ok(), await tasksResponse.text()).toBeTruthy();
    expect(Array.isArray(await tasksResponse.json())).toBeTruthy();

    const calendarResponse = await request.get(`${apiURL}/calendar/project/${projectId}`, {
      headers,
    });
    expect(calendarResponse.ok(), await calendarResponse.text()).toBeTruthy();
    expect(Array.isArray(await calendarResponse.json())).toBeTruthy();

    const notificationsResponse = await request.get(`${apiURL}/notifications/unread-count`, {
      headers,
    });
    expect(notificationsResponse.ok(), await notificationsResponse.text()).toBeTruthy();
    expect(await notificationsResponse.json()).toHaveProperty("count");
  });
});
