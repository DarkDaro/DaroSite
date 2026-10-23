import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadPackage } from "./global.mjs";

const cheerio = loadPackage("cheerio");
const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const files = fs.readdirSync(ROOT).filter((name) => name.endsWith(".html")).sort();
const issues = [];
const rows = [];

for (const file of files) {
  const html = fs.readFileSync(path.join(ROOT, file), "utf8");
  const $ = cheerio.load(html);
  const ids = new Map();
  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (ids.has(id)) issues.push(file + ": duplicate id " + id);
    ids.set(id, true);
  });

  const refs = [];
  $("link[href], script[src]").each((_, element) => {
    const ref = $(element).attr("href") || $(element).attr("src");
    if (!ref || ref.startsWith("http:") || ref.startsWith("https:") || ref.startsWith("data:") || ref.startsWith("#")) return;
    const target = path.resolve(ROOT, ref.split("?")[0]);
    refs.push(ref);
    if (!fs.existsSync(target)) issues.push(file + ": missing asset " + ref);
  });

  const row = {
    file,
    title: $("title").text().trim(),
    lang: $("html").attr("lang") || null,
    description: $('meta[name="description"]').attr("content") || null,
    viewport: $('meta[name="viewport"]').attr("content") || null,
    page: $("body").attr("data-page") || null,
    main: $("#main").length > 0,
    skip: $(".skip-link").length > 0,
    refs: refs.length,
    ids: ids.size
  };
  rows.push(row);

  if (!row.title) issues.push(file + ": no title");
  if (row.lang !== "ru") issues.push(file + ": html lang is not ru");
  if (!row.description) issues.push(file + ": no description");
  if (!row.viewport) issues.push(file + ": no viewport");
  if (!row.page) issues.push(file + ": no body data-page");
  if (!row.main) issues.push(file + ": no main#main");
  if (!row.skip) issues.push(file + ": no skip link");
}

const report = { files: rows, issues };
const reportPath = path.join(os.tmpdir(), "solyanoy-html-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

console.log("HTML", { files: rows.length, issues: issues.length });
for (const row of rows) {
  console.log(row.file, "|", row.page, "|", row.title, "| refs", row.refs);
}
if (issues.length) {
  console.error("Проблемы HTML:", issues.length);
  for (const issue of issues) console.error("-", issue);
  process.exit(1);
}
