import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";
import { loadPlaywright } from "./global.mjs";
import { closeBrowser, closeServer } from "./close.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const ROUTES = [
  "/index.html",
  "/book.html",
  "/chapter.html?n=1",
  "/chapter.html?n=7",
  "/chapter.html?n=19",
  "/library.html",
  "/world.html",
  "/characters.html",
  "/locations.html",
  "/corporations.html",
  "/implants.html",
  "/weapons.html",
  "/gallery.html",
  "/about.html",
  "/dossier.html?id=kira",
  "/dossier.html?id=wet-quarter",
  "/dossier.html?id=quiet-light",
  "/dossier.html?id=gnezdo"
];
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
  const report = { base, viewports: {}, summary: {} };
  let issueCount = 0;
  let browser;

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });
    for (const [viewName, viewport] of Object.entries(VIEWPORTS)) {
      const rows = [];
      for (const route of ROUTES) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        const failedRequests = [];
        const badResponses = [];
        const requests = [];

        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText }));
        page.on("response", (response) => {
          if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
        });
        page.on("request", (request) => requests.push(request.url()));

        let status = null;
        let loadError = null;
        let data = { title: null, scrollWidth: null, innerWidth: null, overflow: [], brokenImages: [] };

        try {
          const response = await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
          status = response ? response.status() : null;
          await page.waitForFunction(
            () => Array.from(document.images).every((img) => img.complete),
            null,
            { timeout: 3000 }
          ).catch(() => {});
          await page.waitForTimeout(150);
          data = await page.evaluate(() => {
            const doc = document.documentElement;
            const broken = Array.from(document.images)
              .filter((img) => img.complete && img.naturalWidth === 0)
              .map((img) => img.currentSrc || img.src);
            const bad = [];
            if (doc.scrollWidth > window.innerWidth + 1) {
              for (const element of document.querySelectorAll("body *")) {
                const rect = element.getBoundingClientRect();
                const style = getComputedStyle(element);
                if (
                  rect.width > 0 &&
                  rect.right > window.innerWidth + 2 &&
                  style.position !== "fixed" &&
                  style.visibility !== "hidden" &&
                  style.display !== "none"
                ) {
                  bad.push({
                    tag: element.tagName,
                    cls: String(element.className || "").slice(0, 80),
                    right: Math.round(rect.right),
                    width: Math.round(rect.width)
                  });
                  if (bad.length >= 5) break;
                }
              }
            }
            return {
              title: document.title,
              scrollWidth: doc.scrollWidth,
              innerWidth: window.innerWidth,
              overflow: bad,
              brokenImages: broken
            };
          });
        } catch (error) {
          loadError = error.message;
        }

        const external = requests.filter((url) => {
          return !(url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:"));
        });
        const issues = [];
        if (status && status >= 400) issues.push("status " + status);
        if (loadError) issues.push("load " + loadError);
        if (consoleErrors.length) issues.push("console " + consoleErrors.length);
        if (pageErrors.length) issues.push("pageerror " + pageErrors.length);
        if (failedRequests.length) issues.push("failed " + failedRequests.length);
        if (badResponses.length) issues.push("bad responses " + badResponses.length);
        if (external.length) issues.push("external " + external.length);
        if (data.brokenImages.length) issues.push("broken images " + data.brokenImages.length);
        if (data.overflow.length) issues.push("overflow " + data.scrollWidth + ">" + data.innerWidth);
        issueCount += issues.length;

        rows.push({
          route,
          status,
          title: data.title,
          issues,
          console: consoleErrors.slice(0, 5),
          pageerrors: pageErrors.slice(0, 5),
          failed: failedRequests.slice(0, 5),
          badResponses: badResponses.slice(0, 5),
          external: external.slice(0, 5),
          brokenImages: data.brokenImages.slice(0, 5),
          overflow: data.overflow
        });
        await context.close();
      }
      report.viewports[viewName] = rows;
    }

    report.summary = {
      routes: ROUTES.length,
      viewports: Object.keys(VIEWPORTS).length,
      pageChecks: ROUTES.length * Object.keys(VIEWPORTS).length,
      issues: issueCount
    };
    const reportPath = path.join(os.tmpdir(), "solyanoy-qa-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("QA", report.summary);
    for (const [viewName, rows] of Object.entries(report.viewports)) {
      const bad = rows.filter((row) => row.issues.length);
      console.log(viewName, "страниц", rows.length, "с ошибками", bad.length);
      for (const row of bad) console.log(" ", row.route, row.issues);
    }
    console.log("Отчёт:", reportPath);
    if (issueCount) process.exitCode = 1;
  } finally {
    await closeBrowser(browser);
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
