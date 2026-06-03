const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const baseUrl = process.env.SDLC_BASE_URL || "http://127.0.0.1:3000";
const outDir = process.env.SDLC_AUDIT_OUT || "/tmp/sdlc-visual-audit";
const routes = [
  "/dashboard",
  "/dashboard/tasks",
  "/dashboard/activity",
  "/dashboard/tasks/1",
  "/dashboard/board",
  "/dashboard/backlog",
  "/dashboard/calendar",
  "/dashboard/settings",
  "/dashboard/devops",
  "/dashboard/reports",
  "/dashboard/workload",
  "/dashboard/team",
  "/dashboard/support",
  "/dashboard/documentation",
  "/admin",
];

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
];

function slug(route) {
  return route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
}

async function auditPage(page, theme) {
  return page.evaluate((themeName) => {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const docOverflow = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    ) - viewportWidth;

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

    const isInsideHorizontalScroller = (el) => {
      let node = el.parentElement;

      while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const overflowX = style.overflowX;

        if (
          ["auto", "scroll"].includes(overflowX) &&
          node.scrollWidth > node.clientWidth + 2
        ) {
          return true;
        }

        node = node.parentElement;
      }

      return false;
    };

    const outOfBounds = visible
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
          className: String(el.className || "").slice(0, 180),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          top: Math.round(rect.top),
          bottom: Math.round(rect.bottom),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          insideHorizontalScroller: isInsideHorizontalScroller(el),
        };
      })
      .filter(
        (item) =>
          !(
            viewportWidth < 768 &&
            item.insideHorizontalScroller &&
            item.left >= -2
          ) &&
          (item.right > viewportWidth + 2 ||
            item.left < -2 ||
            item.width > viewportWidth + 2)
      )
      .slice(0, 20);

    const darkInLight =
      themeName === "light"
        ? visible
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              const bg = style.backgroundColor;
              const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?/);
              if (!match || rect.width * rect.height < 1200) return null;
              const [r, g, b] = match.slice(1).map(Number);
              const alpha = match[4] === undefined ? 1 : Number(match[4]);
              if (alpha < 0.2) return null;
              const isExpectedSolid =
                el.closest("button,[role='button'],a") ||
                String(el.className || "").includes("bg-blue-600");
              if ((r + g + b) / 3 > 95 || isExpectedSolid) return null;
              return {
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
                className: String(el.className || "").slice(0, 180),
                background: bg,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })
            .filter(Boolean)
            .slice(0, 20)
        : [];

    return {
      url: location.pathname,
      viewportWidth,
      viewportHeight,
      docOverflow,
      outOfBounds,
      darkInLight,
    };
  }, theme);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const report = [];

  for (const theme of ["light", "dark"]) {
    const storageState = `/tmp/sdlc-${theme}-storage.json`;
    for (const viewport of viewports) {
      const context = await browser.newContext({
        storageState,
        viewport: { width: viewport.width, height: viewport.height },
      });

      for (const route of routes) {
        const page = await context.newPage();
        const failedRequests = [];
        const consoleErrors = [];

        page.on("requestfailed", (request) => {
          failedRequests.push({
            url: request.url(),
            failure: request.failure()?.errorText || "request failed",
          });
        });
        page.on("console", (message) => {
          if (message.type() === "error") {
            consoleErrors.push(message.text().slice(0, 300));
          }
        });

        try {
          await page.goto(`${baseUrl}${route}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await page.waitForTimeout(900);
          const audit = await auditPage(page, theme);
          const screenshot = path.join(
            outDir,
            `${theme}-${viewport.name}-${slug(route)}.png`
          );
          await page.screenshot({ path: screenshot, fullPage: false });
          report.push({
            theme,
            viewport: viewport.name,
            route,
            screenshot,
            failedRequests,
            consoleErrors,
            ...audit,
          });
        } catch (error) {
          report.push({
            theme,
            viewport: viewport.name,
            route,
            error: error instanceof Error ? error.message : String(error),
            failedRequests,
            consoleErrors,
          });
        } finally {
          await page.close();
        }
      }

      await context.close();
    }
  }

  await browser.close();
  const reportPath = path.join(outDir, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const findings = report.filter(
    (item) =>
      item.error ||
      item.docOverflow > 2 ||
      item.failedRequests?.length ||
      item.consoleErrors?.length ||
      item.outOfBounds?.length ||
      item.darkInLight?.length
  );
  const summary = findings.map((item) => ({
    theme: item.theme,
    viewport: item.viewport,
    route: item.route,
    screenshot: item.screenshot,
    error: item.error,
    docOverflow: item.docOverflow || 0,
    outOfBounds: item.outOfBounds?.length || 0,
    darkInLight: item.darkInLight?.length || 0,
    failedRequests: item.failedRequests?.length || 0,
    consoleErrors: item.consoleErrors || [],
  }));

  console.log(JSON.stringify({ reportPath, findings: summary }, null, 2));
})();
