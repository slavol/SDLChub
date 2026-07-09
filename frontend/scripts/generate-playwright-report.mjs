import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const jsonPath = path.join(rootDir, "test-results", "playwright-results.json");
const outputPath = path.resolve(rootDir, "..", "licenta", "RAPORT_TESTARE_PLAYWRIGHT.md");
const outputSvgPath = path.resolve(rootDir, "..", "licenta", "figures", "playwright-summary.svg");

function walkSuites(suites, rows = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[0] || {};
        rows.push({
          file: spec.file || suite.file || "-",
          title: spec.title,
          project: test.projectName || "-",
          status: result.status || test.outcome || "unknown",
          duration: result.duration || 0,
          error: result.error?.message || "",
        });
      }
    }

    walkSuites(suite.suites, rows);
  }

  return rows;
}

function statusIcon(status) {
  if (status === "passed") return "PASS";
  if (status === "skipped") return "SKIP";
  if (status === "timedOut") return "TIMEOUT";
  if (status === "failed" || status === "interrupted") return "FAIL";
  return status.toUpperCase();
}

function categoryForFile(file) {
  if (file.includes("api-")) {
    if (file.includes("api-ai")) return "API - inteligenta artificiala";
    if (file.includes("auth-account")) return "API - identitate si cont";
    if (file.includes("project-data")) return "API - proiect si raportare";
    if (file.includes("work-items")) return "API - work engine";
    if (file.includes("devops-admin")) return "API - DevOps si admin";
    return "API";
  }
  if (file.includes("api.spec")) return "API";
  if (file.includes("ui-public-auth")) return "UI public/auth";
  if (file.includes("ui-workspace-pages")) return "UI workspace";
  if (file.includes("ui-task-detail")) return "UI task detail";
  if (file.includes("ui-ai-functional")) return "UI AI functional";
  if (file.includes("ui-admin-console")) return "UI admin";
  if (file.includes("ui-responsive")) return "UI responsive";
  if (file.includes("admin")) return "Functional admin";
  return "Functional workspace";
}

function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br />");
}

function mermaidSafeLabel(value) {
  return String(value ?? "-").replace(/"/g, "'");
}

function formatMs(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function groupRows(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row);
    acc[key] ||= [];
    acc[key].push(row);
    return acc;
  }, {});
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortSvgLabel(value, maxLength = 32) {
  const text = String(value ?? "-");
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function renderSummarySvg({ counts, passed, failed, skipped, passRate, coverageRows }) {
  const width = 1440;
  const midpoint = Math.ceil(coverageRows.length / 2);
  const columns = [coverageRows.slice(0, midpoint), coverageRows.slice(midpoint)];
  const rowHeight = 54;
  const chartY = 326;
  const rowsPerColumn = Math.max(1, columns[0].length, columns[1].length);
  const chartHeight = 94 + rowsPerColumn * rowHeight;
  const footerY = chartY + chartHeight + 32;
  const height = footerY + 132;
  const maxTotal = Math.max(1, ...coverageRows.map((row) => row.total));

  const metricCards = [
    { label: "Total teste", value: counts.total, accent: "blue" },
    { label: "Passed", value: passed, accent: "green" },
    { label: "Failed", value: failed, accent: failed ? "red" : "green" },
    { label: "Skipped", value: skipped, accent: "amber" },
    { label: "Pass rate", value: `${passRate}%`, accent: "cyan" },
  ];

  const metricSvg = metricCards
    .map((card, index) => {
      const x = 54 + index * 266;
      return `
  <rect x="${x}" y="176" width="240" height="104" rx="22" class="metric-card"/>
  <circle cx="${x + 196}" cy="214" r="17" class="halo ${card.accent}"/>
  <text x="${x + 24}" y="214" class="metric-label">${escapeXml(card.label)}</text>
  <text x="${x + 24}" y="254" class="metric">${escapeXml(card.value)}</text>`;
    })
    .join("\n");

  const rowsSvg = columns
    .map((columnRows, columnIndex) => {
      const x = columnIndex === 0 ? 84 : 748;
      const labelX = x;
      const barX = x + 278;
      const barWidth = 256;
      const valueX = x + 602;

      return columnRows
        .map((row, index) => {
          const y = chartY + 72 + index * rowHeight;
          const filled = Math.max(10, Math.round((row.total / maxTotal) * barWidth));
          const passedWidth = row.total ? Math.round((row.passed / row.total) * filled) : 0;
          const skippedWidth = row.total ? Math.round((row.skipped / row.total) * filled) : 0;
          const failedWidth = Math.max(0, filled - passedWidth - skippedWidth);

          return `
  <text x="${labelX}" y="${y + 18}" class="label">${escapeXml(shortSvgLabel(row.category))}</text>
  <text x="${labelX}" y="${y + 38}" class="label-sub">${row.rate}% pass rate · ${formatMs(row.duration)}</text>
  <rect x="${barX}" y="${y + 7}" width="${barWidth}" height="18" rx="9" class="bar-bg"/>
  <rect x="${barX}" y="${y + 7}" width="${passedWidth}" height="18" rx="9" class="passed"/>
  <rect x="${barX + passedWidth}" y="${y + 7}" width="${failedWidth}" height="18" class="failed"/>
  <rect x="${barX + passedWidth + failedWidth}" y="${y + 7}" width="${skippedWidth}" height="18" class="skipped"/>
  <text x="${valueX}" y="${y + 21}" class="value">${row.passed}/${row.total}</text>`;
        })
        .join("\n");
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="52%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
    <linearGradient id="cardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#172554" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0.98"/>
    </linearGradient>
  </defs>
  <style>
    .bg { fill: url(#bg); }
    .hero { fill: url(#cardGlow); stroke: #1d4ed8; stroke-opacity: 0.34; stroke-width: 1; }
    .panel { fill: #0b1220; stroke: #26364f; stroke-width: 1; }
    .metric-card { fill: #111827; stroke: #334155; stroke-width: 1; }
    .title { fill: #f8fafc; font: 700 38px Arial, sans-serif; }
    .subtitle { fill: #b6c5dc; font: 400 17px Arial, sans-serif; }
    .kicker { fill: #60a5fa; font: 700 13px Arial, sans-serif; letter-spacing: 4px; }
    .metric { fill: #f8fafc; font: 700 34px Arial, sans-serif; }
    .metric-label { fill: #93c5fd; font: 700 13px Arial, sans-serif; letter-spacing: 1.3px; text-transform: uppercase; }
    .section-title { fill: #f8fafc; font: 700 22px Arial, sans-serif; }
    .section-subtitle { fill: #8ea4c4; font: 400 15px Arial, sans-serif; }
    .label { fill: #e2e8f0; font: 700 15px Arial, sans-serif; }
    .label-sub { fill: #88a1c4; font: 400 12px Arial, sans-serif; }
    .value { fill: #f8fafc; font: 700 16px Arial, sans-serif; text-anchor: end; }
    .bar-bg { fill: #1e293b; }
    .passed { fill: #10b981; }
    .failed { fill: #ef4444; }
    .skipped { fill: #f59e0b; }
    .legend { fill: #cbd5e1; font: 600 13px Arial, sans-serif; }
    .note-title { fill: #dbeafe; font: 700 16px Arial, sans-serif; }
    .note { fill: #94a3b8; font: 400 14px Arial, sans-serif; }
    .halo { opacity: 0.22; }
    .blue { fill: #3b82f6; }
    .green { fill: #10b981; }
    .red { fill: #ef4444; }
    .amber { fill: #f59e0b; }
    .cyan { fill: #22d3ee; }
  </style>
  <rect class="bg" width="${width}" height="${height}" rx="32"/>
  <rect x="34" y="32" width="1372" height="272" rx="30" class="hero"/>
  <text x="66" y="84" class="kicker">RAPORT TESTARE AUTOMATA</text>
  <text x="66" y="128" class="title">SDLC Hub - acoperire Playwright</text>
  <text x="66" y="160" class="subtitle">API, fluxuri functionale, UI desktop, UI mobil si verificari responsive pentru lucrarea de licenta.</text>

${metricSvg}

  <rect x="54" y="${chartY}" width="1332" height="${chartHeight}" rx="26" class="panel"/>
  <text x="84" y="${chartY + 40}" class="section-title">Acoperire pe module</text>
  <text x="84" y="${chartY + 64}" class="section-subtitle">Fiecare rand arata testele trecute din total, plus durata agregata pe categorie.</text>

  <circle cx="1034" cy="${chartY + 44}" r="7" class="passed"/>
  <text x="1050" y="${chartY + 49}" class="legend">Passed</text>
  <circle cx="1134" cy="${chartY + 44}" r="7" class="failed"/>
  <text x="1150" y="${chartY + 49}" class="legend">Failed</text>
  <circle cx="1226" cy="${chartY + 44}" r="7" class="skipped"/>
  <text x="1242" y="${chartY + 49}" class="legend">Skipped</text>

${rowsSvg}

  <rect x="54" y="${footerY}" width="1332" height="92" rx="24" class="panel"/>
  <text x="84" y="${footerY + 38}" class="note-title">Interpretare pentru licenta</text>
  <text x="84" y="${footerY + 64}" class="note">Suita valideaza atat contractele API, cat si experienta utilizatorului in paginile principale, inclusiv scenarii mobile si functionalitati AI.</text>
</svg>`;
}

const generatedAt = new Date().toLocaleString("ro-RO");
let content = "";

if (!fs.existsSync(jsonPath)) {
  content = `# Raport testare automata Playwright - SDLC Hub

Generat la: ${generatedAt}

Nu exista inca fisierul \`frontend/test-results/playwright-results.json\`.

Pentru generare completa:

\`\`\`bash
cd frontend
SDLC_TEST_EMAIL="email@exemplu.ro" SDLC_TEST_PASSWORD="parola" npm run test:e2e:licenta
\`\`\`

Raportul HTML va fi disponibil in \`frontend/playwright-report/index.html\`.
`;
} else {
  const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const rows = walkSuites(data.suites);
  const counts = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { total: 0 }
  );
  const passed = counts.passed || 0;
  const failed = (counts.failed || 0) + (counts.timedOut || 0) + (counts.interrupted || 0);
  const skipped = counts.skipped || 0;
  const passRate = counts.total ? Math.round((passed / counts.total) * 100) : 0;

  const projectNames = [...new Set(rows.map((row) => row.project))].join(", ") || "-";
  const failedRows = rows.filter((row) => !["passed", "skipped"].includes(row.status));
  const categoryGroups = groupRows(rows, (row) => categoryForFile(row.file));
  const statusGroups = groupRows(rows, (row) => row.status);
  const browserGroups = groupRows(rows, (row) => row.project);
  const slowestRows = [...rows].sort((a, b) => b.duration - a.duration).slice(0, 10);
  const totalDuration = rows.reduce((sum, row) => sum + row.duration, 0);
  const averageDuration = rows.length ? totalDuration / rows.length : 0;
  const coverageRows = Object.entries(categoryGroups).map(([category, categoryRows]) => {
    const categoryPassed = categoryRows.filter((row) => row.status === "passed").length;
    const categorySkipped = categoryRows.filter((row) => row.status === "skipped").length;
    const categoryFailed = categoryRows.length - categoryPassed - categorySkipped;
    const categoryRate = categoryRows.length ? Math.round((categoryPassed / categoryRows.length) * 100) : 0;
    return {
      category,
      total: categoryRows.length,
      passed: categoryPassed,
      failed: categoryFailed,
      skipped: categorySkipped,
      rate: categoryRate,
      duration: categoryRows.reduce((sum, row) => sum + row.duration, 0),
    };
  });
  const passedForPie = statusGroups.passed?.length || 0;
  const failedForPie = failed;
  const skippedForPie = skipped;
  const browserRows = Object.entries(browserGroups).map(([project, projectRows]) => {
    const projectPassed = projectRows.filter((row) => row.status === "passed").length;
    const projectSkipped = projectRows.filter((row) => row.status === "skipped").length;
    const projectFailed = projectRows.length - projectPassed - projectSkipped;
    return { project, total: projectRows.length, passed: projectPassed, failed: projectFailed, skipped: projectSkipped };
  });

  fs.mkdirSync(path.dirname(outputSvgPath), { recursive: true });
  fs.writeFileSync(
    outputSvgPath,
    renderSummarySvg({ counts, passed, failed, skipped, passRate, coverageRows }),
    "utf8"
  );

  content = `# Raport testare automata Playwright - SDLC Hub

Generat la: ${generatedAt}

## Scop

Acest raport centralizeaza testele automate pentru aplicatia SDLC Hub si poate fi folosit ca material suport in lucrarea de licenta. Testele acopera trei zone:

- testare API pentru autentificare, endpointuri protejate si functii AI;
- testare functionala pentru fluxurile principale din workspace;
- testare UI/responsive pentru layout desktop si mobil.

## Mediu de rulare

| Element | Valoare |
| --- | --- |
| Frontend URL | ${process.env.SDLC_BASE_URL || "http://127.0.0.1:3000"} |
| Backend API | ${process.env.SDLC_API_URL || "http://127.0.0.1:8000"} |
| Proiecte Playwright | ${escapeCell(projectNames)} |
| Reporter HTML | \`frontend/playwright-report/index.html\` |
| Rezultate JSON | \`frontend/test-results/playwright-results.json\` |

## Rezumat executie

| Total | Passed | Failed | Skipped | Pass rate |
| ---: | ---: | ---: | ---: | ---: |
| ${counts.total} | ${passed} | ${failed} | ${skipped} | ${passRate}% |

## Grafic exportabil pentru lucrare

![Grafic sumar Playwright](figures/playwright-summary.svg)

## Indicatori de calitate

| Indicator | Valoare |
| --- | ---: |
| Durata totala agregata | ${formatMs(totalDuration)} |
| Durata medie per test | ${formatMs(averageDuration)} |
| Categorii acoperite | ${coverageRows.length} |
| Browsere/proiecte Playwright | ${browserRows.length} |
| Teste cu rezultat negativ | ${failed} |

## Grafic rezultat global

\`\`\`mermaid
pie showData
  "Passed" : ${passedForPie}
  "Failed" : ${failedForPie}
  "Skipped" : ${skippedForPie}
\`\`\`

## Grafic acoperire pe categorii

\`\`\`mermaid
xychart-beta
  title "Teste automate pe categorii"
  x-axis [${coverageRows.map((row) => `"${mermaidSafeLabel(row.category)}"`).join(", ")}]
  y-axis "Numar teste" 0 --> ${Math.max(1, ...coverageRows.map((row) => row.total))}
  bar [${coverageRows.map((row) => row.total).join(", ")}]
\`\`\`

## Matrice acoperire pe categorii

| Categorie | Total | Passed | Failed | Skipped | Pass rate | Durata |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${coverageRows
  .map(
    (row) =>
      `| ${escapeCell(row.category)} | ${row.total} | ${row.passed} | ${row.failed} | ${row.skipped} | ${row.rate}% | ${formatMs(row.duration)} |`
  )
  .join("\n")}

## Rezultate pe browser/proiect Playwright

| Browser/proiect | Total | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
${browserRows
  .map((row) => `| ${escapeCell(row.project)} | ${row.total} | ${row.passed} | ${row.failed} | ${row.skipped} |`)
  .join("\n")}

## Acoperire pe categorii

| Categorie | Ce valideaza |
| --- | --- |
| API - inteligenta artificiala | Advisor metodologie, sugestii roluri, generare task, rafinare cerinte, estimare story points, workload AI, provider AI, release notes si documentatie automata |
| API - identitate si cont | Utilizator curent, sumar cont, sesiuni, security log, onboarding, notificari si login invalid |
| API - proiect si raportare | Proiect, membri, roluri, permisiuni, audit, dashboard, reports, workload, AI settings si tranzitie metodologie |
| API - work engine | Tasks board/backlog, task detail, audit task, activity, sprinturi, calendar, disponibilitate, documentatie si echipe |
| API - DevOps si admin | GitHub integration, events, pull requests, ngrok, admin overview, users, projects, tickets, errors si CSV exports |
| Functional workspace | Navigare prin ariile principale si feedback la login invalid |
| UI AI functional | Controale vizuale pentru Spec Refiner, Poker Estimator, Workload Balancer, Project AI provider, Release Notes si documentatie |
| UI workspace | Pagini dashboard, tasks, board, backlog, calendar, activity, workload, reports, documentation, devops, team, support, settings, account si notifications |
| UI task detail | Issue definition, properties, audit log, comments, subtasks si controale |
| UI responsive | Lipsa overflow orizontal, meniu mobil si input cautare Tasks |
| UI admin | Global Admin Console, Identity, Project Registry, Support Desk, AI Usage si System Health |
| UI public/auth | Landing, login, register, forgot/reset/verify email |

## Cele mai lente teste

| Categorie | Proiect browser | Test | Durata |
| --- | --- | --- | ---: |
${slowestRows
  .map((row) => `| ${categoryForFile(row.file)} | ${escapeCell(row.project)} | ${escapeCell(row.title)} | ${formatMs(row.duration)} |`)
  .join("\n")}

## Rezultate detaliate

| Status | Categorie | Proiect browser | Test | Durata |
| --- | --- | --- | --- | ---: |
${rows
  .map(
    (row) =>
      `| ${statusIcon(row.status)} | ${categoryForFile(row.file)} | ${escapeCell(row.project)} | ${escapeCell(row.title)} | ${Math.round(row.duration)} ms |`
  )
  .join("\n")}

${failedRows.length ? `## Erori

${failedRows
  .map(
    (row) => `### ${statusIcon(row.status)} - ${row.title}

- Fisier: \`${row.file}\`
- Browser/proiect: \`${row.project}\`
- Mesaj: ${row.error ? escapeCell(row.error) : "Nu exista mesaj de eroare in JSON."}
`
  )
  .join("\n")}` : "## Erori\n\nNu au fost raportate erori in executia curenta.\n"}

## Observatii pentru lucrarea de licenta

- Testele ruleaza cu date reale de aplicatie, prin contul configurat in \`SDLC_TEST_EMAIL\` si \`SDLC_TEST_PASSWORD\`.
- Testele destructive sunt evitate in mod implicit; scopul este validarea stabilitatii fluxurilor principale.
- Pentru defecte vizuale, Playwright pastreaza screenshot/video/trace doar la esec, in \`frontend/test-results\`.
`;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, content, "utf8");
console.log(`Raport generat: ${outputPath}`);
