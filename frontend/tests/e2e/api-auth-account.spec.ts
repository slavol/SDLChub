import { expect, test } from "@playwright/test";

import { expectArrayResponse, expectObjectResponse, expectOkResponse, expectStatusIn } from "./helpers/assertions";
import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials, testEmail } from "./helpers/auth";

test.describe("API - identitate, cont si notificari", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("returneaza utilizatorul autentificat", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/auth/me`, { headers: authHeaders(session.token) });
    const user = await expectObjectResponse(response, "GET /auth/me");

    expect(user.email).toBe(testEmail);
  });

  test("returneaza sumarul contului si proiectele asociate", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/auth/me/account-summary`, { headers: authHeaders(session.token) });
    const summary = await expectObjectResponse(response, "GET /auth/me/account-summary");

    expect(summary.user).toBeTruthy();
    expect(Array.isArray(summary.projects)).toBeTruthy();
  });

  test("listeaza sesiunile active ale contului", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/auth/me/sessions`, { headers: authHeaders(session.token) });
    const sessions = await expectArrayResponse(response, "GET /auth/me/sessions");

    expect(sessions.length).toBeGreaterThan(0);
  });

  test("listeaza jurnalul de securitate al contului", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/auth/me/security-log?limit=20`, { headers: authHeaders(session.token) });
    await expectArrayResponse(response, "GET /auth/me/security-log");
  });

  test("returneaza statusul de onboarding", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/projects/onboarding/status`, { headers: authHeaders(session.token) });
    const status = await expectObjectResponse(response, "GET /projects/onboarding/status");

    expect(typeof status.has_projects).toBe("boolean");
  });

  test("returneaza invitatiile pending ale utilizatorului", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/projects/invitations/pending`, { headers: authHeaders(session.token) });
    await expectArrayResponse(response, "GET /projects/invitations/pending");
  });

  test("returneaza notificarile utilizatorului", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/notifications`, { headers: authHeaders(session.token) });
    await expectArrayResponse(response, "GET /notifications");
  });

  test("returneaza numarul de notificari necitite", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.get(`${apiURL}/notifications/unread-count`, { headers: authHeaders(session.token) });
    const payload = await expectObjectResponse(response, "GET /notifications/unread-count");

    expect(typeof payload.count).toBe("number");
  });

  test("respinge login-ul invalid cu 401 sau 400", async ({ request }) => {
    const response = await request.post(`${apiURL}/auth/login`, {
      data: { email: "invalid@example.com", password: "wrong-password" },
    });

    await expectStatusIn(response, [400, 401, 403], "POST /auth/login invalid");
  });

  test("accepta cererea de resetare parola ca flux controlat", async ({ request }) => {
    const response = await request.post(`${apiURL}/auth/forgot-password`, {
      data: { email: "e2e-reset-probe@example.com" },
    });

    await expectOkResponse(response, "POST /auth/forgot-password");
  });
});
