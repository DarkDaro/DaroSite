import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";
import { loadPlaywright } from "./global.mjs";
import { closeBrowser, closeServer } from "./close.mjs";

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

    await page.waitForFunction(() => {
      const audio = document.querySelector("audio");
      return !!audio && audio.readyState >= 1;
    }, null, { timeout: 4000 }).catch(() => {});
    const audioHome = await page.evaluate(() => {
      const audio = document.querySelector("audio");
      const button = document.querySelector("[data-sound-toggle]");
      return {
        src: audio ? audio.src : "",
        duration: audio ? audio.duration : 0,
        loop: audio ? audio.loop : false,
        error: audio && audio.error ? audio.error.code : 0,
        hasButton: !!button,
        pressed: button ? button.getAttribute("aria-pressed") : null
      };
    });
    check("Кнопка звука есть в шапке", audioHome.hasButton);
    check("На главной тема дождя", /rain\.mp3/.test(audioHome.src), audioHome.src);
    check("Музыка читается и зациклена", audioHome.duration > 40 && audioHome.loop && !audioHome.error, JSON.stringify(audioHome));

    await page.click("[data-sound-toggle]");
    const muted = await page.evaluate(() => {
      const button = document.querySelector("[data-sound-toggle]");
      return { pressed: button ? button.getAttribute("aria-pressed") : null, stored: localStorage.getItem("sol-sound") };
    });
    check("Звук выключается и запоминается", muted.pressed === "false" && muted.stored === "0", JSON.stringify(muted));
    await page.click("[data-sound-toggle]");

    await page.goto(base + "/gallery.html", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const galleryAudio = await page.evaluate(() => document.querySelector("audio")?.src || "");
    check("В галерее тема неона", /neon\.mp3/.test(galleryAudio), galleryAudio);
    await page.click('[data-group="Персонажи"]');
    await page.waitForTimeout(250);
    const galleryCount = await page.locator("#gal-count").textContent();
    check("Фильтр галереи работает", galleryCount && !galleryCount.startsWith("39"), galleryCount || "нет текста");

    await page.goto(base + "/chapter.html?n=1", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const chapterAudio = await page.evaluate(() => document.querySelector("audio")?.src || "");
    check("В читалке бумажная тема", /paper\.mp3/.test(chapterAudio), chapterAudio);
    const fontBefore = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".reader-text")).fontSize));
    await page.click('[data-font="1"]');
    await page.waitForTimeout(200);
    const fontAfter = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".reader-text")).fontSize));
    check("Шрифт читалки увеличивается", fontAfter > fontBefore, fontBefore + " -> " + fontAfter);

    const voiceChapter = await page.evaluate(() => ({
      button: !!document.querySelector("[data-voice-chapter]"),
      label: document.querySelector("[data-voice-chapter]")?.textContent || "",
      effect: typeof window.SolSound?.effect === "function",
      speak: typeof window.SolSound?.speak === "function"
    }));
    check("Кнопка озвучки главы есть", voiceChapter.button, voiceChapter.label);
    check("Эффекты и озвучка доступны", voiceChapter.effect && voiceChapter.speak);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    const topVisible = await page.evaluate(() => document.getElementById("scroll-top-btn")?.classList.contains("visible"));
    check("Кнопка наверх появляется", !!topVisible);
    const topPosition = await page.evaluate(() => {
      const rect = document.getElementById("scroll-top-btn")?.getBoundingClientRect();
      return { left: rect ? Math.round(rect.left) : 0, right: rect ? Math.round(window.innerWidth - rect.right) : 0, viewport: window.innerWidth };
    });
    check("Кнопка наверх справа", topPosition.right <= 32 && topPosition.left > topPosition.viewport / 2, JSON.stringify(topPosition));
    await page.click("#scroll-top-btn");
    await page.waitForFunction(() => window.scrollY < 2, null, { timeout: 5000 }).catch(() => {});
    const scrollAfter = await page.evaluate(() => window.scrollY);
    check("Кнопка наверх возвращает в начало", scrollAfter < 2, String(scrollAfter));

    await page.goto(base + "/world.html", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const worldAudio = await page.evaluate(() => document.querySelector("audio")?.src || "");
    check("В мире индустриальная тема", /industry\.mp3/.test(worldAudio), worldAudio);
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

    await page.goto(base + "/about.html#sound", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const soundPanel = await page.evaluate(() => ({
      tests: document.querySelectorAll("[data-sound-test]").length,
      heading: document.querySelector("#sound h2")?.textContent || ""
    }));
    check("На странице автора есть проверка звука", soundPanel.tests === 3, soundPanel.heading || "нет блока");

    const volume = await page.evaluate(() => {
      const input = document.querySelector("[data-volume]");
      if (!input) return { ok: false, state: null, label: "" };
      input.value = "45";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return {
        ok: true,
        label: document.querySelector("[data-volume-value]")?.textContent || "",
        stored: localStorage.getItem("sol-volume"),
        state: window.SolSound?.getState?.() || null
      };
    });
    const levelsOk = volume.state && volume.state.musicVolume <= 0.18 && volume.state.effectVolume <= 0.09 && volume.state.voiceVolume <= 0.6;
    const sumOk = volume.state && volume.state.musicVolume + volume.state.effectVolume + volume.state.voiceVolume < 1;
    check("Ползунок громкости работает", volume.ok && volume.state?.masterVolume === 0.45 && volume.label === "45%" && volume.stored === "0.45", JSON.stringify(volume));
    check("Уровни звука без перегруза", levelsOk && sumOk, JSON.stringify(volume.state));

    await page.goto(base + "/dossier.html?id=kira", { waitUntil: "load" });
    await page.waitForTimeout(300);
    const dossierVoice = await page.evaluate(() => ({
      button: !!document.querySelector('[data-voice-kind="character"]'),
      label: document.querySelector('[data-voice-kind="character"]')?.textContent || ""
    }));
    check("Озвучка досье есть", dossierVoice.button, dossierVoice.label);

    const reportPath = path.join(os.tmpdir(), "solyanoy-interactions-report.json");
    fs.writeFileSync(reportPath, JSON.stringify({ checks, issues }, null, 2), "utf8");
    console.log("INTERACTIONS", { checks: checks.length, issues: issues.length });
    for (const item of checks) console.log(item.ok ? "ok" : "FAIL", item.name, item.detail || "");
    console.log("Отчёт:", reportPath);
    if (issues.length) process.exitCode = 1;
  } finally {
    await closeBrowser(browser);
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
