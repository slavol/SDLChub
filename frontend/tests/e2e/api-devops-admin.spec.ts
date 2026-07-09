import { expect, test } from "@playwright/test";

import { expectArrayResponse, expectObjectResponse, expectOkResponse } from "./helpers/assertions";
import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("API - DevOps si Global Admin", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("incarca integrarea GitHub a proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/github/integration/project/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /github/integration/project/{project_id}");
  });

  test("incarca evenimentele GitHub ale proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/github/events/project/${session.project!.id}?limit=50`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /github/events/project/{project_id}");
  });

  test("incarca pull request-urile proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/github/pull-requests/project/${session.project!.id}?limit=50`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /github/pull-requests/project/{project_id}");
  });

  test("incarca statusul ngrok pentru webhook-uri", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/github/ngrok/status`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /github/ngrok/status");
  });

  test("global admin incarca overview-ul platformei", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/overview`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /admin/overview");
  });

  test("global admin incarca utilizatorii", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/users`, {
      headers: authHeaders(session.token),
    });
    const users = await expectArrayResponse(response, "GET /admin/users");

    expect(users.length).toBeGreaterThan(0);
  });

  test("global admin incarca proiectele", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/projects`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /admin/projects");
  });

  test("global admin incarca tichetele de suport", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/tickets`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /admin/tickets");
  });

  test("utilizatorul incarca propriile tichete de suport", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/admin/tickets/mine`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /admin/tickets/mine");
  });

  test("global admin incarca erorile HTTP capturate", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/errors?limit=50`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /admin/errors");
  });

  test("global admin incarca auditul de AI usage", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/ai-usage?limit=50`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /admin/ai-usage");
  });

  test("global admin exporta proiectele CSV", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/export/projects.csv`, {
      headers: authHeaders(session.token),
    });
    await expectOkResponse(response, "GET /admin/export/projects.csv");
  });

  test("global admin exporta utilizatorii CSV", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/export/users.csv`, {
      headers: authHeaders(session.token),
    });
    await expectOkResponse(response, "GET /admin/export/users.csv");
  });

  test("global admin exporta AI usage CSV", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.user.is_global_admin, "Contul de test nu este Global Admin.");

    const response = await request.get(`${apiURL}/admin/export/ai-usage.csv`, {
      headers: authHeaders(session.token),
    });
    await expectOkResponse(response, "GET /admin/export/ai-usage.csv");
  });
});
