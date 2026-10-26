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
  "/pitch.html",
  "/chapter.html?n=1",
  "/chapter.html?n=7",
  "/chapter.html?n=8",
  "/chapter.html?n=9",
  "/chapter.html?n=10",
  "/chapter.html?n=18",
  "/chapter.html?n=19",
  "/chapter.html?n=20",
  "/chapter.html?n=21",
  "/chapter.html?n=22",
  "/chapter.html?n=23",
  "/library.html",
  "/world.html",
  "/map.html",
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
  "/dossier.html?id=gnezdo",
  "/book.html#contents",
  "/about.html#sound"
];
const WIDTHS = [320, 360, 390, 430, 768];
const TARGET = 44;
const MICRO = 10;

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
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          deviceScaleFactor: 1,
          isMobile: true,
          hasTouch: true,
          reducedMotion: "reduce"
        });
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
        await page.waitForTimeout(200);

        const metrics = await page.evaluate(() => {
          const target = 44;
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
          for (const element of document.querySelectorAll("a, button, select, input, textarea, summary, [role=button]")) {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (!(rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none")) continue;
            // Ссылки в тексте не считаем самостоятельными тап-зонами.
            const standalone = style.display !== "inline" || element.matches(
              ".plate, .card, .tab, .chip, .menu-toggle, .search-open, .sound-toggle, .layer-toggle, " +
              ".filter-toggle, .link-arrow, .font-step, .view-toggle button, .lb-nav button, " +
              ".toc-item, .world-cat, .org-card, .work-card, .cross-list a, .brand, .skip-link"
            );
            if (standalone && (rect.width < target || rect.height < target)) {
              smallTargets.push({
                tag: element.tagName,
                cls: String(element.className || "").slice(0, 60),
                text: String(element.textContent || "").trim().slice(0, 40),
                w: Math.round(rect.width),
                h: Math.round(rect.height)
              });
            }
            if (smallTargets.length >= 8) break;
          }

          const tableScroll = [];
          for (const wrap of document.querySelectorAll(".table-wrap")) {
            if (wrap.scrollWidth > wrap.clientWidth + 2) {
              tableScroll.push({
                scrollWidth: Math.round(wrap.scrollWidth),
                clientWidth: Math.round(wrap.clientWidth)
              });
            }
          }

          const toggle = document.querySelector("[data-filter-toggle]");
          const panel = document.querySelector("[data-filter-panel]");
          const filter = toggle && panel ? {
            expanded: toggle.getAttribute("aria-expanded"),
            open: panel.dataset.open,
            display: getComputedStyle(panel).display
          } : null;

          const micro = {};
          const microSelectors = [
            ".status",
            ".gallery-item figcaption .g-meta",
            "table.data th",
            ".card .card-sub",
            ".tool-field label"
          ];
          for (const selector of microSelectors) {
            const element = document.querySelector(selector);
            if (element) micro[selector] = parseFloat(getComputedStyle(element).fontSize);
          }
          const firstCell = document.querySelector("table.data td");
          if (firstCell) {
            const before = getComputedStyle(firstCell, "::before");
            if (before.content && before.content !== "none") micro["table.data td::before"] = parseFloat(before.fontSize);
          }

          const headerElement = document.querySelector(".site-header");
          const headerHeight = headerElement ? Math.round(headerElement.getBoundingClientRect().height) : null;
          const token = parseFloat(getComputedStyle(doc).getPropertyValue("--header-h"));
          const header = headerHeight !== null ? {
            height: headerHeight,
            token,
            match: Math.abs(headerHeight - token) <= 1
          } : null;

          let anchor = null;
          if (location.hash) {
            const anchorTarget = document.querySelector(location.hash);
            if (anchorTarget) {
              const rect = anchorTarget.getBoundingClientRect();
              const head = anchorTarget.querySelector(".section-head");
              const headerRect = headerElement ? headerElement.getBoundingClientRect() : null;
              const headTop = head ? Math.round(head.getBoundingClientRect().top) : null;
              const headerBottom = headerRect ? Math.round(headerRect.bottom) : 0;
              anchor = {
                hash: location.hash,
                top: Math.round(rect.top),
                headTop,
                headerBottom,
                ok: rect.top >= headerBottom - 1 && (headTop === null || headTop >= headerBottom + 20)
              };
            } else {
              anchor = { hash: location.hash, ok: false, missing: true };
            }
          }

          return {
            scrollWidth: doc.scrollWidth,
            innerWidth: window.innerWidth,
            overflow,
            smallTargets,
            tableScroll,
            filter,
            micro,
            header,
            anchor,
            brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).map((img) => img.currentSrc || img.src),
            menuVisible: document.querySelector(".menu-toggle") ? getComputedStyle(document.querySelector(".menu-toggle")).display !== "none" : null,
            navVisible: document.querySelector(".main-nav") ? getComputedStyle(document.querySelector(".main-nav")).display !== "none" : null
          };
        });

        let progress = null;
        if (await page.locator(".reader-progress").count()) {
          await page.evaluate(() => window.scrollTo(0, 700));
          await page.waitForTimeout(120);
          progress = await page.evaluate(() => {
            const header = document.querySelector(".site-header").getBoundingClientRect();
            const bar = document.querySelector(".reader-progress").getBoundingClientRect();
            return {
              headerBottom: Math.round(header.bottom),
              progressTop: Math.round(bar.top)
            };
          });
        }

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
        if (metrics.tableScroll.length) {
          issues.push("table scroll " + metrics.tableScroll.map((item) => item.scrollWidth + ">" + item.clientWidth).join("; "));
        }
        if (metrics.filter && (metrics.filter.expanded !== "false" || metrics.filter.open !== "false" || metrics.filter.display !== "none")) {
          issues.push("filter open");
        }
        const microBad = Object.entries(metrics.micro).filter(([, size]) => size < 10);
        if (microBad.length) {
          issues.push("microtype " + microBad.map(([selector, size]) => selector + " " + size).join("; "));
        }
        if (metrics.header && !metrics.header.match) {
          issues.push("header token " + metrics.header.height + "!=" + metrics.header.token);
        }
        if (metrics.anchor && !metrics.anchor.ok) {
          issues.push("anchor " + metrics.anchor.hash + " top " + metrics.anchor.top);
        }
        if (progress && Math.abs(progress.progressTop - progress.headerBottom) > 2) {
          issues.push("progress " + progress.progressTop + "!=" + progress.headerBottom);
        }
        issueCount += issues.length;

        rows.push({
          route,
          width,
          issues,
          overflow: metrics.overflow,
          smallTargets: metrics.smallTargets,
          tableScroll: metrics.tableScroll,
          filter: metrics.filter,
          micro: metrics.micro,
          header: metrics.header,
          anchor: metrics.anchor,
          progress,
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
      target: TARGET,
      micro: MICRO,
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
