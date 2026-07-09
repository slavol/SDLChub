import { expect, test, type APIRequestContext } from "@playwright/test";

import { expectArrayResponse, expectObjectResponse, expectStatusIn } from "./helpers/assertions";
import { apiURL, authHeaders, loginViaApi, skipWithoutCredentials } from "./helpers/auth";

type WorkItem = {
  id: number;
  key: string;
  title: string;
  status?: string;
  priority?: string;
  description?: string | null;
};

type SprintItem = {
  id: number;
  name: string;
};

async function loadProjectTasks(request: APIRequestContext, token: string, projectId: number) {
  const response = await request.get(`${apiURL}/tasks/project/${projectId}?view=board`, {
    headers: authHeaders(token),
  });

  return (await expectArrayResponse(response, "GET /tasks/project/{project_id}?view=board")) as WorkItem[];
}

async function loadProjectSprints(request: APIRequestContext, token: string, projectId: number) {
  const response = await request.get(`${apiURL}/sprints/project/${projectId}`, {
    headers: authHeaders(token),
  });

  return (await expectArrayResponse(response, "GET /sprints/project/{project_id}")) as SprintItem[];
}

test.describe("API - inteligenta artificiala", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  test("Smart Methodology Advisor recomanda o metodologie pe baza chestionarului", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.post(`${apiURL}/projects/ai-recommend`, {
      headers: authHeaders(session.token),
      data: {
        team_size: "5-11",
        work_nature: "Product development cu release-uri planificate",
        volatility: "Prioritatile sunt stabile pe durata sprintului",
        experience: "Echipa are nevoie de ghidare si ceremonii clare",
        metrics: "Predictibilitate, velocity si sprint goal",
      },
    });
    const recommendation = await expectObjectResponse(response, "POST /projects/ai-recommend");

    expect(["SCRUM", "KANBAN", "SCRUMBAN"]).toContain(recommendation.recommended);
    expect(Number(recommendation.confidence_score)).toBeGreaterThan(0);
    expect(String(recommendation.reasoning || "").length).toBeGreaterThan(20);
    expect(Array.isArray(recommendation.pros)).toBeTruthy();
    expect(Array.isArray(recommendation.cons)).toBeTruthy();
  });

  test("AI Role Suggestions propune roluri pentru metodologia aleasa", async ({ request }) => {
    const session = await loginViaApi(request);
    const response = await request.post(`${apiURL}/projects/ai-roles`, {
      headers: authHeaders(session.token),
      data: {
        methodology: "SCRUMBAN",
        description: "Platforma web pentru managementul proiectelor software cu integrare DevOps si AI local.",
      },
    });
    const payload = await expectObjectResponse(response, "POST /projects/ai-roles");

    expect(Array.isArray(payload.roles)).toBeTruthy();
    expect((payload.roles as unknown[]).length).toBeGreaterThan(0);
  });

  test("Spec Refiner genereaza o descriere structurata pentru un task nou", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.post(`${apiURL}/tasks/ai-generate`, {
      headers: authHeaders(session.token),
      data: {
        project_id: session.project!.id,
        title: "Implementare autentificare cu sesiuni securizate",
        priority: "HIGH",
        context: "SDLC Hub thesis project",
      },
    });
    const payload = await expectObjectResponse(response, "POST /tasks/ai-generate");

    expect(String(payload.description || "").length).toBeGreaterThan(40);
  });

  test("Spec Refiner rafineaza cerinte, criterii de acceptare si subtaskuri", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.post(`${apiURL}/tasks/ai-refine`, {
      headers: authHeaders(session.token),
      data: {
        project_id: session.project!.id,
        title: "Dashboard pentru riscuri de livrare",
        priority: "CRITICAL",
        description: "Managerii trebuie sa vada rapid taskurile overdue, bottleneckurile si comentariile cu risc.",
        context: "Software project management platform",
      },
    });
    const payload = await expectObjectResponse(response, "POST /tasks/ai-refine");

    expect(String(payload.markdown || "").length).toBeGreaterThan(80);
    expect(Array.isArray(payload.acceptance_criteria)).toBeTruthy();
    expect(Array.isArray(payload.suggested_subtasks)).toBeTruthy();
    expect(String(payload.source || "")).toBeTruthy();
  });

  test("Poker Estimator propune story points, incredere si factori de risc", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.post(`${apiURL}/tasks/ai-estimate`, {
      headers: authHeaders(session.token),
      data: {
        project_id: session.project!.id,
        title: "Integrare webhook GitHub pentru pull requests",
        priority: "HIGH",
        description: "Evenimentele de PR trebuie mapate la taskuri, auditate si afisate in pagina DevOps.",
        context: "DevOps integration",
      },
    });
    const payload = await expectObjectResponse(response, "POST /tasks/ai-estimate");

    expect([1, 2, 3, 5, 8, 13, 21]).toContain(payload.story_points);
    expect(Number(payload.confidence)).toBeGreaterThanOrEqual(0);
    expect(String(payload.reasoning || "").length).toBeGreaterThan(10);
    expect(Array.isArray(payload.risk_factors)).toBeTruthy();
  });

  test("Workload Balancer genereaza sugestii explicate pentru redistribuire", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const response = await request.post(`${apiURL}/projects/${session.project!.id}/workload/ai-suggestions`, {
      headers: authHeaders(session.token),
    });
    const payload = await expectObjectResponse(response, "POST /projects/{id}/workload/ai-suggestions");

    expect(String(payload.summary || "").length).toBeGreaterThan(20);
    expect(Array.isArray(payload.suggestions)).toBeTruthy();
    expect((payload.suggestions as unknown[]).length).toBeGreaterThan(0);
    expect(String(payload.source || "")).toBeTruthy();
  });

  test("setarile AI ale proiectului si testul providerului raspund controlat", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");

    const settingsResponse = await request.get(`${apiURL}/projects/${session.project!.id}/ai-settings`, {
      headers: authHeaders(session.token),
    });
    const settings = await expectObjectResponse(settingsResponse, "GET /projects/{id}/ai-settings");

    expect(settings.mode).toBeTruthy();
    expect(settings.provider).toBeTruthy();

    const testResponse = await request.post(`${apiURL}/projects/${session.project!.id}/ai-settings/test`, {
      headers: authHeaders(session.token),
    });
    await expectStatusIn(testResponse, [200, 400], "POST /projects/{id}/ai-settings/test");
    const payload = await testResponse.json();

    if (testResponse.status() === 200) {
      expect(typeof payload.ok).toBe("boolean");
      expect(String(payload.message || "").length).toBeGreaterThan(8);
    } else {
      expect(String(payload.detail || "").length).toBeGreaterThan(8);
    }
  });

  test("Release Notes genereaza sumar pentru un sprint existent", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const sprints = await loadProjectSprints(request, session.token, session.project!.id);
    test.skip(sprints.length === 0, "Proiectul de test nu are sprinturi.");

    const response = await request.post(`${apiURL}/sprints/${sprints[0].id}/release-notes`, {
      headers: authHeaders(session.token),
    });
    const payload = await expectObjectResponse(response, "POST /sprints/{sprint_id}/release-notes");

    expect(String(payload.summary || "").length).toBeGreaterThan(20);
    expect(Array.isArray(payload.highlights)).toBeTruthy();
    expect(Array.isArray(payload.known_issues)).toBeTruthy();
    expect(String(payload.markdown || "").length).toBeGreaterThan(20);
  });

  test("documentatia automata se poate genera dintr-un task finalizat", async ({ request }) => {
    const session = await loginViaApi(request);
    test.skip(!session.project, "Contul de test nu are proiecte asociate.");
    const tasks = await loadProjectTasks(request, session.token, session.project!.id);
    const doneTask = tasks.find((task) => task.status === "DONE" || task.status === "Done");
    test.skip(!doneTask, "Proiectul de test nu are task Done pentru documentatie automata.");

    const response = await request.post(`${apiURL}/documentation/from-task/${doneTask!.id}`, {
      headers: authHeaders(session.token),
    });
    const page = await expectObjectResponse(response, "POST /documentation/from-task/{task_id}");

    expect(page.task_id).toBe(doneTask!.id);
    expect(String(page.title || "")).toContain(doneTask!.key);
    expect(String(page.content || "").length).toBeGreaterThan(80);
  });
});
