import { expect, test } from "@playwright/test";

import { expectArrayResponse, expectObjectResponse, expectStatusIn } from "./helpers/assertions";
import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials } from "./helpers/auth";

test.describe("API - proiect, configurare si raportare", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("incarca detaliile proiectului selectat", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}`, {
      headers: authHeaders(session.token),
    });
    const project = await expectObjectResponse(response, "GET /projects/{id}");

    expect(project.key).toBe(session.project!.key);
  });

  test("incarca membrii proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/members`, {
      headers: authHeaders(session.token),
    });
    const members = await expectArrayResponse(response, "GET /projects/{id}/members");

    expect(members.length).toBeGreaterThan(0);
  });

  test("incarca permisiunile utilizatorului curent in proiect", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/my-permissions`, {
      headers: authHeaders(session.token),
    });
    const permissions = await expectObjectResponse(response, "GET /projects/{id}/my-permissions");

    expect(permissions.permissions).toBeTruthy();
  });

  test("incarca rolurile proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/roles`, {
      headers: authHeaders(session.token),
    });
    const roles = await expectArrayResponse(response, "GET /projects/{id}/roles");

    expect(roles.length).toBeGreaterThan(0);
  });

  test("incarca invitatiile sau refuza controlat accesul", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/invitations`, {
      headers: authHeaders(session.token),
    });

    await expectStatusIn(response, [200, 403, 423], "GET /projects/{id}/invitations");
  });

  test("incarca audit log-ul proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/audit-logs?limit=20`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /projects/{id}/audit-logs");
  });

  test("incarca sumarul dashboardului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/dashboard/summary`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /projects/{id}/dashboard/summary");
  });

  test("incarca activitatea dashboardului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/dashboard/activity`, {
      headers: authHeaders(session.token),
    });
    await expectArrayResponse(response, "GET /projects/{id}/dashboard/activity");
  });

  test("incarca dashboardul complet al proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/dashboard`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /projects/{id}/dashboard");
  });

  test("incarca overview-ul de rapoarte", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/reports/overview`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /projects/{id}/reports/overview");
  });

  test("incarca workload-ul proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/workload`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /projects/{id}/workload");
  });

  test("incarca setarile AI ale proiectului", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.get(`${apiURL}/projects/${session.project!.id}/ai-settings`, {
      headers: authHeaders(session.token),
    });
    await expectObjectResponse(response, "GET /projects/{id}/ai-settings");
  });

  test("returneaza preview pentru tranzitia metodologiei", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const target = session.project!.methodology === "KANBAN" ? "SCRUMBAN" : "KANBAN";
    const response = await request.get(`${apiURL}/projects/${session.project!.id}/methodology-transition-preview?target=${target}`, {
      headers: authHeaders(session.token),
    });
    const preview = await expectObjectResponse(response, "GET /projects/{id}/methodology-transition-preview");

    expect(preview.target_methodology).toBe(target);
  });
});
