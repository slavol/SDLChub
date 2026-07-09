import { spawnSync } from "node:child_process";
import process from "node:process";

const playwrightBin = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(playwrightBin, ["playwright", "test"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});

spawnSync(process.execPath, ["scripts/generate-playwright-report.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
