import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";
import { loadPlaywright } from "./global.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const ROUTES = ["/index.html", "/book.html", "/chapter.html?n=1", "/gallery.html", "/world.html"];
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 }
};

function findChromium() {
  const base = path.join(process.env.LOCALAPPDATA || "", "ms-playwright");
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs.readdirSync(base)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of dirs) {
    const exe = path.join(base, dir, "chrome-win64", "chrome.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function main() {
  const server = createStaticServer(ROOT);
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  const base = "http://127.0.0.1:" + port;
  const report = { base, checks: [] };
  let issues = 0;
  let browser;

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      const context = await browser.newContext({ viewport, isMobile: name === "mobile", hasTouch: name === "mobile" });
      for (const route of ROUTES) {
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        const requests = [];
        page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("request", (request) => requests.push(request.url()));

        const response = await page.goto(base + route, { waitUntil: "load", timeout: 20000 });
        await page.waitForFunction(
          () => Array.from(document.images).every((img) => img.complete),
          null,
          { timeout: 2500 }
        ).catch(() => {});
        await page.waitForTimeout(80);
        const data = await page.evaluate(() => ({
          title: document.title,
          overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
          brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length
        }));
        const external = requests.filter((url) => !(url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")));
        const problems = [];
        if (response && response.status() >= 400) problems.push("status " + response.status());
        if (consoleErrors.length) problems.push("console " + consoleErrors.length);
        if (pageErrors.length) problems.push("pageerror " + pageErrors.length);
        if (external.length) problems.push("external " + external.length);
        if (data.brokenImages) problems.push("broken images " + data.brokenImages);
        if (data.overflow) problems.push("overflow");
        issues += problems.length;
        report.checks.push({ viewport: name, route, title: data.title, problems });
        await page.close();
      }
      await context.close();
    }

    const reportPath = path.join(os.tmpdir(), "solyanoy-quick-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("QUICK", { checks: report.checks.length, issues });
    for (const check of report.checks) {
      if (check.problems.length) console.log(" ", check.viewport, check.route, check.problems);
    }
    console.log("Отчёт:", reportPath);
    if (issues) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
