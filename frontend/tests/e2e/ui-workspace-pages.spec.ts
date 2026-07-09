import { test } from "@playwright/test";

import { expectNoHorizontalOverflow, expectPageContains } from "./helpers/assertions";
import { loginPageViaApi, skipWithoutCredentials } from "./helpers/auth";

const workspacePages = [
  { path: "/dashboard", label: "dashboard", text: /Delivery overview|Work Distribution|My Active/i },
  { path: "/dashboard/tasks", label: "tasks", text: /Task filters|Tasks for|Create Issue/i },
  { path: "/dashboard/board", label: "board", text: /Active Sprint|Sprint board|Create Issue|No active sprint/i },
  { path: "/dashboard/backlog", label: "backlog", text: /Sprint Planning|Backlog|Create Sprint|Release Notes/i },
  { path: "/dashboard/calendar", label: "calendar", text: /Month|Week|Day|Agenda|Upcoming/i },
  { path: "/dashboard/activity", label: "activity", text: /Activity Center|Timeline|Filters/i },
  { path: "/dashboard/workload", label: "workload", text: /Team capacity|AI workload desk|Generate suggestions/i },
  { path: "/dashboard/reports", label: "reports", text: /Delivery reports|Velocity|Completion|Burn/i },
  { path: "/dashboard/documentation", label: "documentation", text: /Documentation|Generate|Wiki|New documentation/i },
  { path: "/dashboard/devops", label: "devops", text: /DevOps|Repository|GitHub|webhook/i },
  { path: "/dashboard/devops/pull-requests", label: "pull requests", text: /Pull Requests|Review|DevOps|repository/i },
  { path: "/dashboard/team", label: "team", text: /Team management|Team hierarchy|Members|Invite/i },
  { path: "/dashboard/support", label: "support", text: /Support|ticket|priority|comment/i },
  { path: "/dashboard/settings", label: "settings", text: /Project settings|General|AI provider|Danger/i },
  { path: "/dashboard/account", label: "account", text: /Profile|Security|My projects|Notifications/i },
  { path: "/dashboard/notifications", label: "notifications", text: /Notifications|Unread|Read|empty/i },
];

test.describe("UI - workspace complet", () => {
  test.beforeEach(() => {
    skipWithoutCredentials();
  });

  for (const item of workspacePages) {
    test(`incarca pagina ${item.label}`, async ({ page, request }) => {
      await loginPageViaApi(page, request);

      await page.goto(item.path);
      await expectPageContains(page, item.text);
      await expectNoHorizontalOverflow(page);
    });
  }
});
