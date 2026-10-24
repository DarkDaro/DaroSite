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
  "/chapter.html?n=8",
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
const WIDTHS = [320, 360, 390, 430, 768];

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
  const report = { base, widths: {}, summary: {} };
  let issueCount = 0;
  let browser;

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });

    for (const width of WIDTHS) {
      const rows = [];
      for (const route of ROUTES) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const consoleErrors = [];
        const pageErrors = [];
        const requests = [];

        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));
        page.on("request", (request) => requests.push(request.url()));

        const response = await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
        await page.waitForFunction(
          () => Array.from(document.images).every((img) => img.complete),
          null,
          { timeout: 3000 }
        ).catch(() => {});
        await page.waitForTimeout(120);

        const metrics = await page.evaluate(() => {
          const doc = document.documentElement;
          const overflow = [];
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
                let clipped = false;
                let parent = element.parentElement;
                while (parent && parent !== document.body) {
                  const parentStyle = getComputedStyle(parent);
                  if (["hidden", "clip"].includes(parentStyle.overflowX) || ["hidden", "clip"].includes(parentStyle.overflow)) {
                    clipped = true;
                    break;
                  }
                  parent = parent.parentElement;
                }
                if (!clipped) {
                  overflow.push({
                    tag: element.tagName,
                    cls: String(element.className || "").slice(0, 80),
                    right: Math.round(rect.right),
                    width: Math.round(rect.width)
                  });
                }
                if (overflow.length >= 5) break;
              }
            }
          }

          const smallTargets = [];
          for (const element of document.querySelectorAll("a, button, select, input")) {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none") {
              if (rect.width < 32 || rect.height < 32) {
                smallTargets.push({
                  tag: element.tagName,
                  cls: String(element.className || "").slice(0, 60),
                  text: String(element.textContent || "").trim().slice(0, 40),
                  w: Math.round(rect.width),
                  h: Math.round(rect.height)
                });
              }
            }
            if (smallTargets.length >= 8) break;
          }

          const menu = document.querySelector(".menu-toggle");
          const nav = document.querySelector(".main-nav");
          return {
            scrollWidth: doc.scrollWidth,
            innerWidth: window.innerWidth,
            overflow,
            smallTargets,
            brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src),
            menuVisible: menu ? getComputedStyle(menu).display !== "none" : null,
            navVisible: nav ? getComputedStyle(nav).display !== "none" : null
          };
        });

        if (width <= 900 && metrics.menuVisible === false) {
          metrics.overflow.push({ tag: "HEADER", cls: "menu-toggle", right: 0, width: 0 });
        }

        const external = requests.filter((url) => !(url.startsWith(base) || url.startsWith("data:") || url.startsWith("blob:")));
        const issues = [];
        if (response && response.status() >= 400) issues.push("status " + response.status());
        if (consoleErrors.length) issues.push("console " + consoleErrors.length);
        if (pageErrors.length) issues.push("pageerror " + pageErrors.length);
        if (external.length) issues.push("external " + external.length);
        if (metrics.brokenImages.length) issues.push("broken images " + metrics.brokenImages.length);
        if (metrics.overflow.length) issues.push("overflow " + metrics.scrollWidth + ">" + metrics.innerWidth);
        if (metrics.smallTargets.length) issues.push("small targets " + metrics.smallTargets.length);
        issueCount += issues.length;

        rows.push({
          route,
          width,
          issues,
          overflow: metrics.overflow,
          smallTargets: metrics.smallTargets,
          brokenImages: metrics.brokenImages.slice(0, 5),
          menuVisible: metrics.menuVisible,
          navVisible: metrics.navVisible
        });
        await context.close();
      }
      report.widths[width] = rows;
    }

    report.summary = {
      routes: ROUTES.length,
      widths: WIDTHS.length,
      pageChecks: ROUTES.length * WIDTHS.length,
      issues: issueCount
    };
    const reportPath = path.join(os.tmpdir(), "solyanoy-mobile-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("MOBILE", report.summary);
    for (const [width, rows] of Object.entries(report.widths)) {
      const bad = rows.filter((row) => row.issues.length);
      console.log(width + "px", "страниц", rows.length, "с замечаниями", bad.length);
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
