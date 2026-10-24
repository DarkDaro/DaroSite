import path from "node:path";
import fs from "node:fs";
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
  const base = "http://127.0.0.1:" + port;
  const issues = [];
  const checks = [];
  let browser;

  function check(name, ok, detail) {
    checks.push({ name, ok, detail });
    if (!ok) issues.push(name + (detail ? ": " + detail : ""));
  }

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();

    await page.goto(base + "/index.html", { waitUntil: "load" });
    await page.waitForTimeout(400);
    await page.click("[data-open-menu]");
    await page.waitForSelector("#menu-dialog[open]", { timeout: 3000 });
    const menu = await page.evaluate(() => {
      const dialog = document.querySelector("#menu-dialog");
      const link = dialog ? dialog.querySelector(".menu-nav a") : null;
      return {
        open: dialog ? dialog.open : false,
        linkHeight: link ? Math.round(link.getBoundingClientRect().height) : 0
      };
    });
    check("Меню открывается", menu.open);
    check("Ссылка меню не меньше 40px", menu.linkHeight >= 40, String(menu.linkHeight));
    await page.click("[data-close-menu]");
    await page.waitForTimeout(150);

    await page.click("[data-open-search]");
    await page.waitForSelector("#search-dialog[open]", { timeout: 3000 });
    await page.fill("#search-input", "Кира");
    await page.waitForSelector(".search-result", { timeout: 3000 });
    const searchCount = await page.locator(".search-result").count();
    check("Поиск находит Киру", searchCount > 0, String(searchCount));
    await page.click("[data-close-search]");
    await page.waitForTimeout(100);

    await page.goto(base + "/gallery.html", { waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.click('[data-group="Персонажи"]');
    await page.waitForTimeout(250);
    const galleryCount = await page.locator("#gal-count").textContent();
    check("Фильтр галереи работает", galleryCount && !galleryCount.startsWith("39"), galleryCount || "нет текста");

    await page.goto(base + "/chapter.html?n=1", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const fontBefore = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".reader-text")).fontSize));
    await page.click('[data-font="1"]');
    await page.waitForTimeout(200);
    const fontAfter = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".reader-text")).fontSize));
    check("Шрифт читалки увеличивается", fontAfter > fontBefore, fontBefore + " -> " + fontAfter);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const topVisible = await page.evaluate(() => document.getElementById("scroll-top-btn")?.classList.contains("visible"));
    check("Кнопка наверх появляется", !!topVisible);
    await page.click("#scroll-top-btn");
    await page.waitForFunction(() => window.scrollY < 2, null, { timeout: 5000 }).catch(() => {});
    const scrollAfter = await page.evaluate(() => window.scrollY);
    check("Кнопка наверх возвращает в начало", scrollAfter < 2, String(scrollAfter));

    await page.goto(base + "/world.html", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const worldList = await page.evaluate(() => {
      const list = document.querySelector(".cross-list");
      const link = list ? list.querySelector("a") : null;
      return {
        display: list ? getComputedStyle(list).display : null,
        height: link ? Math.round(link.getBoundingClientRect().height) : 0
      };
    });
    check("Мобильный список локаций виден", worldList.display === "grid", worldList.display || "нет списка");
    check("Ссылка локации не меньше 44px", worldList.height >= 44, String(worldList.height));

    await page.goto(base + "/chapter.html?n=1", { waitUntil: "load" });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(350);
    const sticky = await page.evaluate(() => {
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const progress = document.querySelector(".reader-progress").getBoundingClientRect();
      return { headerTop: Math.round(header.top), headerBottom: Math.round(header.bottom), progressTop: Math.round(progress.top) };
    });
    check("Шапка держится сверху", sticky.headerTop === 0, JSON.stringify(sticky));
    check("Прогресс держится под шапкой", sticky.progressTop >= sticky.headerBottom - 2 && sticky.progressTop <= sticky.headerBottom + 12, JSON.stringify(sticky));

    const reportPath = path.join(os.tmpdir(), "solyanoy-interactions-report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ checks, issues }, null, 2), "utf8");
    console.log("INTERACTIONS", { checks: checks.length, issues: issues.length });
    for (const item of checks) console.log(item.ok ? "ok" : "FAIL", item.name, item.detail || "");
    console.log("Отчёт:", reportPath);
    if (issues.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
