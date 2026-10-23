import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DATA = path.join(ROOT, "assets", "js", "data.js");
const issues = [];

function syntax(file) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
    console.log("syntax ok:", path.relative(ROOT, file));
  } catch (error) {
    const detail = error.stderr ? error.stderr.toString() : error.message;
    issues.push("syntax " + path.relative(ROOT, file) + ": " + detail.trim());
  }
}

function readSite() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DATA, "utf8"), context);
  return context.window.SITE;
}

function checkCounts(site) {
  const expected = {
    chapters: 34,
    characters: 10,
    locations: 10,
    corporations: 7,
    implants: 8,
    weapons: 7,
    glossary: 16,
    gallery: 39
  };
  for (const [key, value] of Object.entries(expected)) {
    const actual = Array.isArray(site[key]) ? site[key].length : null;
    if (actual !== value) issues.push(key + ": expected " + value + ", got " + actual);
  }
}

function checkChapters(site) {
  const numbers = new Set(site.chapters.map((chapter) => chapter.n));
  for (let n = 1; n <= 34; n++) if (!numbers.has(n)) issues.push("missing chapter " + n);
  for (const chapter of site.chapters) {
    if (chapter.n === 1 && !chapter.text) issues.push("chapter 1 text is empty");
    if (chapter.n !== 1 && chapter.text) issues.push("chapter " + chapter.n + " should be a stub");
    if (chapter.n >= 1 && chapter.n <= 11 && chapter.part !== 1) issues.push("chapter " + chapter.n + ": wrong part");
    if (chapter.n >= 12 && chapter.n <= 23 && chapter.part !== 2) issues.push("chapter " + chapter.n + ": wrong part");
    if (chapter.n >= 24 && chapter.n <= 34 && chapter.part !== 3) issues.push("chapter " + chapter.n + ": wrong part");
  }
  const first = site.chapters.find((chapter) => chapter.n === 1);
  if (first && first.text) {
    const words = first.text.split(/\s+/).filter(Boolean).length;
    if (words < 1800) issues.push("chapter 1 is too short: " + words + " words");
    if (first.text.includes("\u2014")) issues.push("chapter 1 contains an em dash");
  }
}

function checkEntities(site) {
  const groups = {
    characters: site.characters,
    locations: site.locations,
    corporations: site.corporations,
    implants: site.implants,
    weapons: site.weapons
  };
  const all = new Map();
  for (const [kind, items] of Object.entries(groups)) {
    for (const item of items) {
      if (all.has(item.id)) issues.push("duplicate id " + item.id + " (" + kind + ")");
      all.set(item.id, { kind, item });
    }
  }
  for (const character of site.characters) {
    for (const relation of character.relations || []) {
      if (!all.has(relation.id)) issues.push("character " + character.id + ": missing relation " + relation.id);
    }
    for (const implant of character.implants || []) {
      if (!all.has(implant) || all.get(implant).kind !== "implants") issues.push("character " + character.id + ": missing implant " + implant);
    }
  }
  for (const location of site.locations) {
    for (const relation of location.related || []) if (!all.has(relation)) issues.push("location " + location.id + ": missing " + relation);
  }
  for (const corporation of site.corporations) {
    for (const relation of corporation.related || []) if (!all.has(relation)) issues.push("corporation " + corporation.id + ": missing " + relation);
  }
  for (const implant of site.implants) {
    for (const relation of implant.related || []) if (!all.has(relation)) issues.push("implant " + implant.id + ": missing " + relation);
  }
  for (const weapon of site.weapons) {
    for (const relation of weapon.related || []) if (!all.has(relation)) issues.push("weapon " + weapon.id + ": missing " + relation);
  }
  for (const term of site.glossary) {
    if (!all.has(term.link)) issues.push("glossary " + term.term + ": missing link " + term.link);
  }
}

function checkAssets(site) {
  const art = path.join(ROOT, "assets", "art");
  for (const [slug, meta] of Object.entries(site.images)) {
    for (const width of meta.widths) {
      const file = path.join(art, slug + "-" + width + ".webp");
      if (!fs.existsSync(file)) issues.push("missing image " + path.relative(ROOT, file));
    }
  }
  for (const character of site.characters) {
    if (character.portrait && !site.images[character.portrait]) issues.push("character " + character.id + ": unknown portrait " + character.portrait);
  }
  for (const location of site.locations) {
    if (!site.images[location.img]) issues.push("location " + location.id + ": unknown image " + location.img);
  }
}

function main() {
  for (const file of ["assets/js/data.js", "assets/js/app.js", "assets/js/chrome.js"]) syntax(path.join(ROOT, file));
  const site = readSite();
  checkCounts(site);
  checkChapters(site);
  checkEntities(site);
  checkAssets(site);
  if (issues.length) {
    console.error("Проверка не пройдена. Ошибок:", issues.length);
    for (const issue of issues) console.error("-", issue);
    process.exit(1);
  }
  console.log("Проверка пройдена.");
  console.log("Глав:", site.chapters.length, "персонажей:", site.characters.length, "локаций:", site.locations.length);
  console.log("Галерея:", site.gallery.length, "пластин. Глава 1:", site.chapters[0].text.split(/\s+/).filter(Boolean).length, "слов.");
}

main();
