import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

export type TestUser = {
  id: number;
  email: string;
  full_name?: string;
  is_active?: boolean;
  is_global_admin?: boolean;
};

export type TestProject = {
  id: number;
  name: string;
  key: string;
  methodology: string;
  owner_id: number;
  is_archived?: boolean;
};

export type AuthSession = {
  token: string;
  user: TestUser;
  projects: TestProject[];
  project?: TestProject;
};

export const apiURL = process.env.SDLC_API_URL || "http://127.0.0.1:8000";
export const testEmail = process.env.SDLC_TEST_EMAIL || "";
export const testPassword = process.env.SDLC_TEST_PASSWORD || "";
export const preferredProjectKey = process.env.SDLC_TEST_PROJECT_KEY || "GFW";

export function hasCredentials() {
  return Boolean(testEmail && testPassword);
}

export function skipWithoutCredentials() {
  test.skip(!hasCredentials(), "Seteaza SDLC_TEST_EMAIL si SDLC_TEST_PASSWORD pentru testele autentificate.");
}

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function pickTestProject(projects: TestProject[]) {
  const byEnvKey = projects.find((project) => project.key === preferredProjectKey && !project.is_archived);
  const byDemoKey = projects.find((project) => project.key === "GFW" && !project.is_archived);
  const firstActive = projects.find((project) => !project.is_archived);

  return byEnvKey || byDemoKey || firstActive || projects[0];
}

export async function loginViaApi(request: APIRequestContext): Promise<AuthSession> {
  expect(testEmail, "SDLC_TEST_EMAIL trebuie setat").toBeTruthy();
  expect(testPassword, "SDLC_TEST_PASSWORD trebuie setat").toBeTruthy();

  const loginResponse = await request.post(`${apiURL}/auth/login`, {
    data: {
      email: testEmail,
      password: testPassword,
    },
  });

  expect(loginResponse.ok(), await loginResponse.text()).toBeTruthy();
  const loginData = await loginResponse.json();
  const token = loginData.access_token as string;
  const user = loginData.user as TestUser;

  const projectsResponse = await request.get(`${apiURL}/projects/mine`, {
    headers: authHeaders(token),
  });

  expect(projectsResponse.ok(), await projectsResponse.text()).toBeTruthy();
  const projects = (await projectsResponse.json()) as TestProject[];

  return {
    token,
    user,
    projects,
    project: pickTestProject(projects),
  };
}

export async function installAuthenticatedState(page: Page, session: AuthSession) {
  await page.addInitScript(
    ({ token, user, project }) => {
      window.localStorage.setItem(
        "auth-storage",
        JSON.stringify({
          state: {
            token,
            user,
            isAuthenticated: true,
          },
          version: 0,
        })
      );

      if (project) {
        window.localStorage.setItem(
          "project-storage",
          JSON.stringify({
            state: {
              currentProject: project,
              hasHydrated: true,
            },
            version: 0,
          })
        );
      }
    },
    {
      token: session.token,
      user: session.user,
      project: session.project,
    }
  );
}

export async function loginPageViaApi(page: Page, request: APIRequestContext) {
  const session = await loginViaApi(request);
  await installAuthenticatedState(page, session);
  return session;
}
