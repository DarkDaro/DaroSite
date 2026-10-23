import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";
import { loadPlaywright } from "./global.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");

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
  const origin = "http://127.0.0.1:" + port;
  const queue = [{ route: "/index.html", from: "seed" }];
  const visited = new Set();
  const external = new Set();
  const pages = [];
  const issues = [];
  let browser;

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    while (queue.length && visited.size < 200) {
      const entry = queue.shift();
      const route = entry.route;
      if (visited.has(route)) continue;
      visited.add(route);
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      const response = await page.goto(origin + route, { waitUntil: "load", timeout: 15000 });
      const status = response ? response.status() : 0;
      const title = await page.title();
      const links = await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).map((link) => String(link.getAttribute("href") || "")));
      for (const href of links) {
        let url;
        try {
          url = new URL(href, origin + route);
        } catch (error) {
          continue;
        }
        if (url.origin !== origin) {
          external.add(url.origin);
          continue;
        }
        if (!["http:", "https:"].includes(url.protocol)) continue;
        if (/\.(webp|png|jpe?g|gif|css|js|woff2?|ttf|otf|svg)$/i.test(url.pathname)) continue;
        const next = url.pathname + url.search;
        if (next && !visited.has(next)) queue.push({ route: next, from: route });
      }

      pages.push({ route, from: entry.from, status, title, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length, links: links.length });
      if (status >= 400) issues.push(route + ": status " + status);
      if (consoleErrors.length) issues.push(route + ": console " + consoleErrors.length);
      if (pageErrors.length) issues.push(route + ": pageerror " + pageErrors.length);
      await page.close();
    }
    await context.close();

    const report = { origin, pages, visited: visited.size, external: [...external].sort(), issues };
    const reportPath = path.join(os.tmpdir(), "solyanoy-crawl-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
    console.log("CRAWL", { pages: pages.length, issues: issues.length, externalHosts: external.size });
    for (const page of pages) console.log(" ", page.status, page.route, "|", page.title);
    if (external.size) console.log("Внешние ссылки:", [...external].sort().join(", "));
    console.log("Отчёт:", reportPath);
    if (issues.length) {
      console.error("Проблемы обхода:", issues.length);
      for (const issue of issues) console.error("-", issue);
      process.exitCode = 1;
    }
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
