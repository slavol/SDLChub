const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const outDir = path.resolve("licenta/figures");
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  {
    url: "https://www.atlassian.com/software/jira/features",
    file: "related-jira.png",
    wait: 5000,
  },
  {
    url: "https://trello.com/guide",
    file: "related-trello.png",
    wait: 5000,
  },
  {
    url: "https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects",
    file: "related-github-projects.png",
    wait: 3000,
  },
];

async function hideCookieBanners(page) {
  const buttonNames = [
    /accept all cookies/i,
    /accept all/i,
    /accept cookies/i,
    /reject all cookies/i,
    /reject all/i,
    /got it/i,
  ];

  for (const name of buttonNames) {
    try {
      await page.getByRole("button", { name }).first().click({ timeout: 1200 });
      await page.waitForTimeout(700);
      break;
    } catch {
      // Some pages do not show a banner or use non-button elements.
    }
  }

  await page.evaluate(() => {
    const pattern = /cookie|cookies|consent|privacy|tracking|gdpr|accept all|reject all/i;
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = (element.textContent || "").slice(0, 500);
      const isOverlay =
        (style.position === "fixed" || style.position === "sticky") &&
        rect.width > window.innerWidth * 0.45 &&
        rect.height > 40 &&
        pattern.test(text);

      if (isOverlay) {
        element.style.setProperty("display", "none", "important");
      }
    }
  });
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  for (const item of pages) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    await page.goto(item.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(item.wait);
    await hideCookieBanners(page);
    await page.screenshot({ path: path.join(outDir, item.file), fullPage: false });
    await page.close();
    console.log(`Captured ${item.file}`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
