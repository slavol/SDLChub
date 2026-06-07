const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const FRONTEND_URL = process.env.SDLC_BASE_URL || "http://127.0.0.1:3000";
const API_URL = process.env.SDLC_API_URL || "http://127.0.0.1:8000";
const TOKEN_FILE = process.env.SDLC_TOKEN_FILE || "/tmp/sdlc-token.txt";
const LIGHT_STORAGE = process.env.SDLC_LIGHT_STORAGE || "/tmp/sdlc-light-storage.json";
const DARK_STORAGE = process.env.SDLC_DARK_STORAGE || "/tmp/sdlc-dark-storage.json";
const REPORT_PATH = process.env.SDLC_MANUAL_REPORT || path.resolve("raport_testare_manuala.txt");
const TEST_EMAIL = process.env.SDLC_TEST_EMAIL || "";
const TEST_PASSWORD = process.env.SDLC_TEST_PASSWORD || "";

const results = [];
const cleanupNotes = [];

function stamp() {
  return new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
}

function add(status, area, check, detail = "") {
  results.push({ status, area, check, detail });
}

function pass(area, check, detail = "") {
  add("PASS", area, check, detail);
}

function fail(area, check, detail = "") {
  add("FAIL", area, check, detail);
}

function warn(area, check, detail = "") {
  add("WARN", area, check, detail);
}

function skip(area, check, detail = "") {
  add("SKIP", area, check, detail);
}

function readToken() {
  try {
    return fs.readFileSync(TOKEN_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

async function ensureAuthenticatedState() {
  let token = readToken();
  let user = null;

  if (!token && TEST_EMAIL && TEST_PASSWORD) {
    const login = await request(
      "POST",
      "/auth/login",
      { email: TEST_EMAIL, password: TEST_PASSWORD },
      "",
      [200]
    );
    token = login.data.access_token;
    user = login.data.user;
    fs.writeFileSync(TOKEN_FILE, token);
    pass("Setup", "Login for automated manual runner", user?.email || TEST_EMAIL);
  }

  if (!token) {
    fail(
      "Setup",
      "Authenticated token",
      `${TOKEN_FILE} missing and SDLC_TEST_EMAIL/SDLC_TEST_PASSWORD were not provided`
    );
    return "";
  }

  if (!user) {
    try {
      const me = await request("GET", "/auth/me", undefined, token);
      user = me.data;
    } catch {
      if (TEST_EMAIL && TEST_PASSWORD) {
        try {
          fs.rmSync(TOKEN_FILE, { force: true });
        } catch {
          // ignore token cleanup failures in the runner
        }
        const login = await request(
          "POST",
          "/auth/login",
          { email: TEST_EMAIL, password: TEST_PASSWORD },
          "",
          [200]
        );
        token = login.data.access_token;
        user = login.data.user;
        fs.writeFileSync(TOKEN_FILE, token);
        pass("Setup", "Refreshed expired runner token", user?.email || TEST_EMAIL);
      } else {
        throw new Error("Existing token is invalid and no login credentials were provided.");
      }
    }
  }

  const projects = await request("GET", "/projects/mine", undefined, token, [200]);
  const currentProject = Array.isArray(projects.data) && projects.data.length ? projects.data[0] : null;
  const origin = new URL(FRONTEND_URL).origin;

  const baseLocalStorage = [
    {
      name: "auth-storage",
      value: JSON.stringify({
        state: { token, isAuthenticated: true, user },
        version: 0,
      }),
    },
    {
      name: "project-storage",
      value: JSON.stringify({
        state: { currentProject, hasHydrated: true },
        version: 0,
      }),
    },
  ];

  for (const [theme, storagePath] of [
    ["light", LIGHT_STORAGE],
    ["dark", DARK_STORAGE],
  ]) {
    fs.writeFileSync(
      storagePath,
      JSON.stringify(
        {
          cookies: [],
          origins: [
            {
              origin,
              localStorage: [
                ...baseLocalStorage,
                { name: "theme", value: theme },
              ],
            },
          ],
        },
        null,
        2
      )
    );
    pass("Setup", `${theme} Playwright storage state generated`, storagePath);
  }

  return token;
}

async function request(method, route, body, token, expected = [200]) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_URL}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!expected.includes(response.status)) {
    const detail =
      typeof data === "string" ? data : JSON.stringify(data || {}, null, 2);
    throw new Error(`${method} ${route} expected ${expected.join("/")} got ${response.status}: ${detail}`);
  }

  return { status: response.status, data };
}

async function auditPage(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const docOverflow =
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth;
    const title = document.title;
    const bodyText = document.body.innerText.slice(0, 500);
    const visible = Array.from(document.querySelectorAll("body *")).filter((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return (
        rect.width > 1 &&
        rect.height > 1 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        Number(style.opacity) > 0.01
      );
    });
    const outOfBounds = visible
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -3 || item.right > viewportWidth + 3 || item.width > viewportWidth + 3)
      .slice(0, 8);

    return { title, bodyText, docOverflow, outOfBounds };
  });
}

async function runPublicUi(browser) {
  const routes = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/onboarding", "/project-wizard"];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  for (const route of routes) {
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text().slice(0, 220));
    });
    try {
      await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(500);
      const audit = await auditPage(page);
      if (audit.docOverflow > 2 || audit.outOfBounds.length) {
        fail("Public UI", `${route} responsive bounds`, JSON.stringify(audit.outOfBounds));
      } else {
        pass("Public UI", `${route} loads without horizontal overflow`);
      }
      if (consoleErrors.length) {
        warn("Public UI", `${route} console errors`, consoleErrors.join(" | "));
      }
      if (route === "/" && !audit.bodyText.includes("SDLC Hub")) {
        warn("Public UI", "Landing branding", "Landing page did not expose SDLC Hub in first body text sample.");
      }
    } catch (error) {
      fail("Public UI", `${route} loads`, String(error.message || error));
    } finally {
      await page.close();
    }
  }

  await context.close();
}

async function runAuthenticatedUi(browser) {
  const routes = [
    "/dashboard",
    "/dashboard/tasks",
    "/dashboard/activity",
    "/dashboard/board",
    "/dashboard/backlog",
    "/dashboard/calendar",
    "/dashboard/settings",
    "/dashboard/devops",
    "/dashboard/devops/pull-requests",
    "/dashboard/reports",
    "/dashboard/workload",
    "/dashboard/team",
    "/dashboard/support",
    "/dashboard/documentation",
    "/dashboard/account",
    "/dashboard/notifications",
    "/admin",
  ];

  for (const theme of ["light", "dark"]) {
    const storageState = theme === "light" ? LIGHT_STORAGE : DARK_STORAGE;
    if (!fs.existsSync(storageState)) {
      skip("Authenticated UI", `${theme} storage`, `${storageState} missing`);
      continue;
    }

    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 },
    ]) {
      const context = await browser.newContext({
        storageState,
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const route of routes) {
        const page = await context.newPage();
        const failedRequests = [];
        const consoleErrors = [];
        page.on("requestfailed", (request) => {
          failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || "request failed"}`);
        });
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text().slice(0, 220));
        });

        try {
          await page.goto(`${FRONTEND_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(900);
          const audit = await auditPage(page);
          const redirectedToLogin = page.url().includes("/login");

          if (redirectedToLogin) {
            fail("Authenticated UI", `${theme}/${viewport.name} ${route}`, "Redirected to login; storage state may be invalid.");
          } else if (audit.docOverflow > 2 || audit.outOfBounds.length) {
            fail("Authenticated UI", `${theme}/${viewport.name} ${route} bounds`, JSON.stringify(audit.outOfBounds));
          } else {
            pass("Authenticated UI", `${theme}/${viewport.name} ${route} loads`);
          }

          const hardFailures = failedRequests.filter((item) => !item.includes("/_next/static"));
          if (hardFailures.length) {
            warn("Authenticated UI", `${theme}/${viewport.name} ${route} failed requests`, hardFailures.slice(0, 4).join(" | "));
          }
          if (consoleErrors.length) {
            warn("Authenticated UI", `${theme}/${viewport.name} ${route} console errors`, consoleErrors.slice(0, 4).join(" | "));
          }
        } catch (error) {
          fail("Authenticated UI", `${theme}/${viewport.name} ${route}`, String(error.message || error));
        } finally {
          await page.close();
        }
      }

      await context.close();
    }
  }
}

async function runMobileDrawerCheck(browser) {
  if (!fs.existsSync(LIGHT_STORAGE)) {
    skip("Mobile shell", "Drawer animation/usability", "No light storage state.");
    return;
  }

  const context = await browser.newContext({
    storageState: LIGHT_STORAGE,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(900);
    await page.getByLabel("Open navigation").click();
    await page.waitForTimeout(350);
    const visible = await page.locator("text=Navigation").first().isVisible();
    await page.getByLabel("Close navigation").first().click();
    await page.waitForTimeout(350);
    const stillVisible = await page.locator("text=Navigation").first().isVisible().catch(() => false);
    if (visible && !stillVisible) {
      pass("Mobile shell", "Hamburger drawer opens and closes");
    } else {
      fail("Mobile shell", "Hamburger drawer opens and closes", `visible=${visible}, stillVisible=${stillVisible}`);
    }
  } catch (error) {
    fail("Mobile shell", "Hamburger drawer", String(error.message || error));
  } finally {
    await page.close();
    await context.close();
  }
}

async function runApiReadChecks(token) {
  const root = await request("GET", "/", undefined, "");
  if (String(root.data?.message || root.data || "").includes("SDLC Hub")) {
    pass("Backend health", "Root endpoint branding");
  } else {
    warn("Backend health", "Root endpoint branding", JSON.stringify(root.data));
  }

  await request("GET", "/openapi.json", undefined, "");
  pass("Backend health", "OpenAPI available");

  await request("POST", "/auth/login", { email: "qa-missing-user@sdlchub.dev", password: "wrong-password" }, "", [401]);
  pass("Auth", "Invalid login is rejected");

  await request("POST", "/auth/forgot-password", { email: "qa-missing-user@sdlchub.dev" }, "", [200]);
  pass("Auth", "Forgot password unknown email returns safe response");

  const me = await request("GET", "/auth/me", undefined, token);
  pass("Auth", "Current user loads", `${me.data.email} / ${me.data.full_name}`);

  const account = await request("GET", "/auth/me/account-summary", undefined, token);
  pass("Account", "Account summary loads", `${account.data.projects_count} project(s)`);

  const sessions = await request("GET", "/auth/me/sessions", undefined, token);
  pass("Account", "Active sessions load", `${sessions.data.length} session(s)`);

  const securityLog = await request("GET", "/auth/me/security-log?limit=10", undefined, token);
  pass("Account", "Security log loads", `${securityLog.data.length} event(s)`);

  const notifications = await request("GET", "/notifications/unread-count", undefined, token);
  pass("Notifications", "Unread count loads", String(notifications.data?.count ?? JSON.stringify(notifications.data)));

  const projects = await request("GET", "/projects/mine", undefined, token);
  if (!projects.data.length) throw new Error("No project available for authenticated checks.");
  pass("Projects", "Projects list loads", projects.data.map((project) => `${project.key}:${project.methodology}`).join(", "));

  for (const project of projects.data.slice(0, 2)) {
    const projectId = project.id;
    await request("GET", `/projects/${projectId}`, undefined, token);
    pass("Projects", `${project.key} detail loads`);
    await request("GET", `/projects/${projectId}/members`, undefined, token);
    pass("Team", `${project.key} members load`);
    await request("GET", `/projects/${projectId}/roles`, undefined, token);
    pass("Team", `${project.key} roles load`);
    await request("GET", `/projects/${projectId}/my-permissions`, undefined, token);
    pass("Permissions", `${project.key} permissions load`);
    await request("GET", `/projects/${projectId}/dashboard/summary`, undefined, token);
    pass("Dashboard", `${project.key} summary loads`);
    await request("GET", `/projects/${projectId}/dashboard`, undefined, token);
    pass("Dashboard", `${project.key} dashboard data loads`);
    await request("GET", `/projects/${projectId}/reports/overview`, undefined, token);
    pass("Reports", `${project.key} reports overview loads`);
    await request("GET", `/projects/${projectId}/workload`, undefined, token);
    pass("Workload", `${project.key} workload loads`);
    await request("GET", `/projects/${projectId}/dashboard/activity?limit=20`, undefined, token);
    pass("Activity", `${project.key} activity loads`);
    await request("GET", `/calendar/project/${projectId}`, undefined, token);
    pass("Calendar", `${project.key} events load`);
    await request("GET", `/calendar/project/${projectId}/availability`, undefined, token);
    pass("Calendar", `${project.key} availability loads`);
    await request("GET", `/documentation/project/${projectId}`, undefined, token);
    pass("Documentation", `${project.key} pages load`);
    await request("GET", `/github/integration/project/${projectId}`, undefined, token);
    pass("DevOps", `${project.key} integration status loads`);
    await request("GET", `/github/events/project/${projectId}?limit=20`, undefined, token);
    pass("DevOps", `${project.key} project GitHub events load`);
    await request("GET", `/github/pull-requests/project/${projectId}?limit=20`, undefined, token);
    pass("DevOps", `${project.key} PR list loads`);

    const tasks = await request("GET", `/tasks/project/${projectId}?view=board`, undefined, token);
    pass("Tasks", `${project.key} task list loads`, `${tasks.data.length} task(s)`);
    if (tasks.data[0]) {
      const task = tasks.data[0];
      await request("GET", `/tasks/${task.id}`, undefined, token);
      pass("Task Detail", `${task.key} detail loads`);
      await request("GET", `/tasks/${task.id}/audit`, undefined, token);
      pass("Task Detail", `${task.key} audit loads`);
      await request("GET", `/github/events/task/${task.id}?limit=10`, undefined, token);
      pass("DevOps", `${task.key} task GitHub events endpoint loads`);
    }
  }

  await request("GET", "/github/ngrok/status", undefined, token);
  pass("DevOps", "Ngrok status endpoint loads");

  await request("GET", "/admin/overview", undefined, token, [200, 403]);
  pass("Global Admin", "Admin overview endpoint responds");
  await request("GET", "/admin/tickets/mine", undefined, token);
  pass("Support", "User support tickets load");
}

async function runControlledMutationChecks(token) {
  const key = `QA${stamp().slice(-6)}`;
  let project = null;
  let task = null;
  let subtask = null;
  let comment = null;
  let event = null;
  let availability = null;
  let sprint = null;
  let ticket = null;

  try {
    const createdProject = await request(
      "POST",
      "/projects/create_full",
      {
        name: `QA Manual ${key}`,
        key,
        description: "Temporary project created by manual QA runner.",
        methodology: "SCRUMBAN",
        roles: [{ name: "Developer", description: "QA test role", emails: [] }],
      },
      token
    );
    project = createdProject.data;
    cleanupNotes.push(`Temporary project created: ${project.key} (#${project.id})`);
    pass("Controlled data", "Temporary SCRUMBAN project created", `${project.key} #${project.id}`);

    const members = await request("GET", `/projects/${project.id}/members`, undefined, token);
    const ownerUserId = members.data[0]?.user?.id;

    const createdSprint = await request(
      "POST",
      "/sprints/",
      {
        name: "QA Sprint",
        project_id: project.id,
        goal: "Validate sprint CRUD",
        start_date: "2026-06-07T09:00:00Z",
        end_date: "2026-06-14T17:00:00Z",
      },
      token
    );
    sprint = createdSprint.data;
    pass("Sprints", "Create sprint with dates", `#${sprint.id}`);

    await request("POST", `/sprints/${sprint.id}/start`, undefined, token);
    pass("Sprints", "Start sprint");

    const createdTask = await request(
      "POST",
      "/tasks/",
      {
        title: "QA Manual CRUD task",
        description: "Initial rich text/plain content for manual QA.",
        priority: "HIGH",
        story_points: 5,
        due_date: "2026-06-20T12:00:00Z",
        project_id: project.id,
        assignee_id: ownerUserId,
        sprint_id: sprint.id,
        subtasks: ["Initial subtask from create"],
      },
      token
    );
    task = createdTask.data;
    pass("Tasks", "Create task with story points, due date, assignee, sprint and subtask", `${task.key} #${task.id}`);

    const updatedTask = await request(
      "PUT",
      `/tasks/${task.id}`,
      { status: "IN_PROGRESS", priority: "CRITICAL", title: "QA Manual CRUD task updated" },
      token
    );
    task = updatedTask.data;
    pass("Tasks", "Update task status/priority/title");

    await request(
      "POST",
      `/tasks/${task.id}/estimate/invalidate`,
      { reason: "QA scope changed during manual governance validation." },
      token
    );
    pass("Task governance", "Invalidate estimate with required reason");

    const createdSubtask = await request("POST", `/tasks/${task.id}/subtasks`, { title: "QA extra subtask" }, token);
    subtask = createdSubtask.data;
    pass("Subtasks", "Create subtask");
    await request("PUT", `/tasks/${task.id}/subtasks/${subtask.id}`, { title: "QA extra subtask edited" }, token);
    pass("Subtasks", "Edit subtask title");
    await request("PUT", `/tasks/${task.id}/subtasks/${subtask.id}`, { is_done: true }, token);
    pass("Subtasks", "Toggle subtask done");
    await request("DELETE", `/tasks/${task.id}/subtasks/${subtask.id}`, undefined, token);
    pass("Subtasks", "Delete subtask");
    subtask = null;

    const createdComment = await request("POST", `/tasks/${task.id}/comments`, { body: "QA comment with @nobody and risk wording for audit." }, token);
    comment = createdComment.data;
    pass("Comments", "Create comment");
    await request("PUT", `/tasks/${task.id}/comments/${comment.id}`, { body: "QA edited comment body." }, token);
    pass("Comments", "Edit own comment");
    await request("DELETE", `/tasks/${task.id}/comments/${comment.id}`, undefined, token);
    pass("Comments", "Delete own comment");
    comment = null;

    const audit = await request("GET", `/tasks/${task.id}/audit`, undefined, token);
    const auditActions = new Set(audit.data.map((item) => item.action));
    for (const action of ["TASK_CREATED", "TASK_UPDATED", "ESTIMATE_INVALIDATED", "SUBTASK_CREATED", "SUBTASK_UPDATED", "SUBTASK_DELETED", "COMMENT_ADDED", "COMMENT_UPDATED", "COMMENT_DELETED"]) {
      if (auditActions.has(action)) {
        pass("Audit", `${action} recorded`);
      } else {
        warn("Audit", `${action} missing after controlled flow`, Array.from(auditActions).join(", "));
      }
    }

    const createdEvent = await request(
      "POST",
      `/calendar/project/${project.id}`,
      {
        title: "QA Calendar Meeting",
        description: "Temporary QA meeting.",
        event_type: "MEETING",
        starts_at: "2026-06-21T09:00:00Z",
        ends_at: "2026-06-21T10:00:00Z",
        location: "Remote / QA",
        meeting_url: "https://meet.google.com/qa-manual-test",
        attendee_ids: ownerUserId ? [ownerUserId] : [],
      },
      token
    );
    event = createdEvent.data;
    pass("Calendar", "Create event with link, location and attendees", `#${event.id}`);
    await request("PUT", `/calendar/${event.id}`, { title: "QA Calendar Meeting Updated" }, token);
    pass("Calendar", "Edit calendar event");
    await request("DELETE", `/calendar/${event.id}`, undefined, token);
    pass("Calendar", "Delete calendar event");
    event = null;

    const createdAvailability = await request(
      "POST",
      `/calendar/project/${project.id}/availability`,
      {
        user_id: ownerUserId,
        status: "VACATION",
        title: "QA Vacation",
        starts_at: "2026-06-22T00:00:00Z",
        ends_at: "2026-06-23T00:00:00Z",
        all_day: true,
        note: "Temporary QA availability block.",
      },
      token
    );
    availability = createdAvailability.data;
    pass("Calendar availability", "Create vacation block", `#${availability.id}`);
    await request("PUT", `/calendar/availability/${availability.id}`, { status: "FOCUS_TIME", title: "QA Focus Time" }, token);
    pass("Calendar availability", "Edit availability block");
    await request("DELETE", `/calendar/availability/${availability.id}`, undefined, token);
    pass("Calendar availability", "Delete availability block");
    availability = null;

    const githubIntegration = await request(
      "PUT",
      `/github/integration/project/${project.id}`,
      {
        repository_full_name: "owner/repository",
        repository_url: "https://github.com/owner/repository",
        default_branch: "main",
        webhook_url: "https://example.ngrok-free.app/github/webhook",
        auto_link_commits: true,
        auto_transition_prs: true,
      },
      token
    );
    pass("DevOps", "Save GitHub integration settings", githubIntegration.data.repository_full_name);
    await request("POST", `/github/integration/project/${project.id}/test`, undefined, token, [200]);
    pass("DevOps", "Test GitHub integration endpoint responds");

    const transitionTargets = ["SCRUM", "KANBAN", "SCRUMBAN"];
    for (const target of transitionTargets) {
      const preview = await request("GET", `/projects/${project.id}/methodology-transition-preview?target=${target}`, undefined, token);
      if (preview.data.target_methodology === target) {
        pass("Methodology", `Preview ${target}`);
      } else {
        fail("Methodology", `Preview ${target}`, JSON.stringify(preview.data));
      }
      const applied = await request("POST", `/projects/${project.id}/methodology-transition`, { target_methodology: target, strategy: "qa_manual" }, token);
      project = applied.data.project;
      pass("Methodology", `Apply ${target}`, applied.data.message);
    }

    const ticketCreated = await request(
      "POST",
      "/admin/tickets",
      {
        title: `QA support ticket ${key}`,
        description: "Temporary support ticket created by manual QA runner.",
        priority: "HIGH",
      },
      token
    );
    ticket = ticketCreated.data;
    pass("Support", "Create support ticket", `#${ticket.id}`);
    const ticketComment = await request("POST", `/admin/tickets/${ticket.id}/comments`, { body: "QA support comment." }, token);
    pass("Support", "Create support ticket comment", `#${ticketComment.data.id}`);
    await request("DELETE", `/admin/tickets/${ticket.id}/comments/${ticketComment.data.id}`, undefined, token);
    pass("Support", "Delete support ticket comment");
    await request("DELETE", `/admin/tickets/${ticket.id}`, undefined, token);
    pass("Support", "Delete support ticket");
    ticket = null;

    await request(
      "DELETE",
      `/tasks/${task.id}`,
      { reason: "QA cleanup after manual runner validation.", confirm_key: task.key },
      token
    );
    pass("Task governance", "Delete task with confirm key and reason");
    task = null;

    await request("POST", `/sprints/${sprint.id}/complete`, undefined, token, [200, 400]);
    pass("Sprints", "Complete sprint endpoint responds");

    await request("DELETE", `/projects/${project.id}`, { confirmation_key: project.key }, token);
    pass("Controlled data", "Temporary project deleted");
    project = null;
  } catch (error) {
    fail("Controlled data", "Mutation flow stopped", String(error.message || error));
  } finally {
    if (ticket) {
      try {
        await request("DELETE", `/admin/tickets/${ticket.id}`, undefined, token);
        cleanupNotes.push(`Cleaned ticket #${ticket.id}`);
      } catch (error) {
        cleanupNotes.push(`Could not clean ticket #${ticket.id}: ${error.message}`);
      }
    }
    if (availability) {
      try {
        await request("DELETE", `/calendar/availability/${availability.id}`, undefined, token);
        cleanupNotes.push(`Cleaned availability #${availability.id}`);
      } catch (error) {
        cleanupNotes.push(`Could not clean availability #${availability.id}: ${error.message}`);
      }
    }
    if (event) {
      try {
        await request("DELETE", `/calendar/${event.id}`, undefined, token);
        cleanupNotes.push(`Cleaned calendar event #${event.id}`);
      } catch (error) {
        cleanupNotes.push(`Could not clean calendar event #${event.id}: ${error.message}`);
      }
    }
    if (project) {
      try {
        await request("DELETE", `/projects/${project.id}`, { confirmation_key: project.key }, token);
        cleanupNotes.push(`Cleaned project ${project.key} #${project.id}`);
      } catch (error) {
        cleanupNotes.push(`Could not clean project ${project.key} #${project.id}: ${error.message}`);
      }
    }
  }
}

function writeReport() {
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  const lines = [];
  lines.push("RAPORT TESTARE MANUALA SDLC HUB");
  lines.push(`Data rulare: ${new Date().toLocaleString("ro-RO")}`);
  lines.push(`Frontend: ${FRONTEND_URL}`);
  lines.push(`Backend: ${API_URL}`);
  lines.push("");
  lines.push("REZUMAT");
  lines.push(`PASS: ${counts.PASS || 0}`);
  lines.push(`FAIL: ${counts.FAIL || 0}`);
  lines.push(`WARN: ${counts.WARN || 0}`);
  lines.push(`SKIP: ${counts.SKIP || 0}`);
  lines.push("");

  for (const status of ["FAIL", "WARN", "SKIP", "PASS"]) {
    const items = results.filter((item) => item.status === status);
    if (!items.length) continue;
    lines.push(status);
    for (const item of items) {
      lines.push(`- [${item.area}] ${item.check}${item.detail ? ` :: ${item.detail}` : ""}`);
    }
    lines.push("");
  }

  lines.push("OBSERVATII");
  lines.push("- Testele UI sunt headless Playwright, nu inspectie vizuala umana pixel-cu-pixel.");
  lines.push("- Email inbox real, GitHub webhook real si ngrok real nu pot fi confirmate complet fara servicii externe conectate.");
  lines.push("- Fluxurile destructive au fost rulate pe proiect temporar QA si curatate la final cand a fost posibil.");
  if (cleanupNotes.length) {
    lines.push("");
    lines.push("CLEANUP");
    cleanupNotes.forEach((note) => lines.push(`- ${note}`));
  }

  fs.writeFileSync(REPORT_PATH, `${lines.join("\n")}\n`);
  console.log(JSON.stringify({ reportPath: REPORT_PATH, counts }, null, 2));
}

(async () => {
  let token = "";
  try {
    token = await ensureAuthenticatedState();
  } catch (error) {
    fail("Setup", "Authenticated state generation", String(error.message || error));
  }

  let browser = null;
  try {
    browser = await chromium.launch({ headless: true });
    await runPublicUi(browser);
    await runAuthenticatedUi(browser);
    await runMobileDrawerCheck(browser);
  } catch (error) {
    fail("Playwright", "Browser test runner", String(error.message || error));
  } finally {
    if (browser) await browser.close();
  }

  if (token) {
    try {
      await runApiReadChecks(token);
    } catch (error) {
      fail("API read checks", "Stopped", String(error.message || error));
    }

    try {
      await runControlledMutationChecks(token);
    } catch (error) {
      fail("API mutation checks", "Stopped", String(error.message || error));
    }
  }

  writeReport();
})().catch((error) => {
  fail("Runner", "Fatal error", String(error.message || error));
  writeReport();
  process.exitCode = 1;
});
