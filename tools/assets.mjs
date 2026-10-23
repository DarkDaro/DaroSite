import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadPackage } from "./global.mjs";

const sharp = loadPackage("sharp");
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const ART = path.join(ROOT, "assets", "art");
const DATA = path.join(ROOT, "assets", "js", "data.js");

function readSite() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DATA, "utf8"), context);
  return context.window.SITE;
}

async function main() {
  const site = readSite();
  const expected = new Map();
  for (const [slug, meta] of Object.entries(site.images)) {
    for (const width of meta.widths) {
      expected.set(slug + "-" + width + ".webp", { slug, width });
    }
  }

  const files = fs.readdirSync(ART).filter((name) => name.endsWith(".webp")).sort();
  const missing = [...expected.keys()].filter((name) => !files.includes(name));
  const extra = files.filter((name) => !expected.has(name));
  const issues = [];
  const items = [];
  let totalBytes = 0;

  for (const file of files) {
    const filePath = path.join(ART, file);
    const stat = fs.statSync(filePath);
    totalBytes += stat.size;
    try {
      const meta = await sharp(filePath).metadata();
      const expectedMeta = expected.get(file);
      const item = { file, bytes: stat.size, width: meta.width, height: meta.height, format: meta.format };
      items.push(item);
      if (meta.format !== "webp") issues.push(file + ": format " + meta.format);
      if (expectedMeta && meta.width !== expectedMeta.width) {
        issues.push(file + ": width " + meta.width + ", expected " + expectedMeta.width);
      }
    } catch (error) {
      issues.push(file + ": " + error.message);
    }
  }

  for (const file of missing) issues.push("missing " + file);
  const largest = items.slice().sort((a, b) => b.bytes - a.bytes).slice(0, 5);
  const report = {
    counts: { expected: expected.size, files: files.length, extra: extra.length, missing: missing.length },
    totalBytes,
    totalMB: Number((totalBytes / 1024 / 1024).toFixed(2)),
    largest,
    extra,
    issues
  };
  const reportPath = path.join(os.tmpdir(), "solyanoy-assets-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("ASSETS", report.counts);
  console.log("Размер:", report.totalMB, "MB");
  console.log("Самые большие:");
  for (const item of largest) console.log(" ", item.file, item.width + "x" + item.height, Math.round(item.bytes / 1024) + " KB");
  if (extra.length) console.log("Лишние файлы:", extra.join(", "));
  console.log("Отчёт:", reportPath);
  if (issues.length) {
    console.error("Проблемы ассетов:", issues.length);
    for (const issue of issues) console.error("-", issue);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
