import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./server.mjs";
import { loadPlaywright } from "./global.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const route = process.argv[2] || "/index.html";
const widthArg = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : "390";
const heightArg = process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4] : "844";
const width = Number(widthArg);
const height = Number(heightArg);
const fullPage = process.argv.includes("--full");

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
  let browser;

  try {
    const { chromium } = await loadPlaywright();
    browser = await chromium.launch({ headless: true, executablePath: findChromium() });
    const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 900, hasTouch: width < 900 });
    const response = await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
    await page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      null,
      { timeout: 3000 }
    ).catch(() => {});
    await page.waitForTimeout(200);

    const slug = route.replace(/[^a-z0-9а-яё]+/gi, "-").replace(/^-+|-+$/g, "") || "page";
    const file = path.join(os.tmpdir(), "solyanoy-shot-" + slug + "-" + width + ".png");
    await page.screenshot({ path: file, fullPage });
    const metrics = await page.evaluate(() => ({
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length
    }));
    console.log("SHOT", { route, width, height, fullPage, status: response ? response.status() : null });
    console.log("Файл:", file);
    console.log("Метрики:", metrics);
    if (metrics.overflow || metrics.brokenImages) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
