import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import os from "node:os";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const DATA = path.join(ROOT, "assets", "js", "data.js");

function readSite() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(DATA, "utf8"), context);
  return context.window.SITE;
}

function words(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = String(item[key] ?? "не указано");
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function main() {
  const site = readSite();
  const issues = [];
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

  const chapters = site.chapters.map((chapter) => ({
    n: chapter.n,
    title: chapter.title,
    part: chapter.part,
    pov: chapter.pov,
    day: chapter.day,
    status: chapter.status,
    words: words(chapter.text),
    synopsisChars: String(chapter.synopsis || "").length,
    synopsis: chapter.synopsis || ""
  }));

  for (const chapter of site.chapters) {
    if (!chapter.title) issues.push("chapter " + chapter.n + ": no title");
    if (!chapter.synopsis) issues.push("chapter " + chapter.n + ": no synopsis");
    if (!chapter.pov) issues.push("chapter " + chapter.n + ": no POV");
    if (chapter.day === undefined || chapter.day === null) issues.push("chapter " + chapter.n + ": no day");
    if (chapter.n === 1 && !chapter.text) issues.push("chapter 1: no text");
    if (chapter.n !== 1 && chapter.text) issues.push("chapter " + chapter.n + ": unexpected full text");
  }

  for (const character of site.characters) {
    for (const relation of character.relations || []) {
      if (!all.has(relation.id)) issues.push("character " + character.id + ": missing relation " + relation.id);
    }
  }
  for (const location of site.locations) {
    for (const relation of location.related || []) {
      if (!all.has(relation)) issues.push("location " + location.id + ": missing " + relation);
    }
  }
  for (const corporation of site.corporations) {
    for (const relation of corporation.related || []) {
      if (!all.has(relation)) issues.push("corporation " + corporation.id + ": missing " + relation);
    }
  }
  for (const term of site.glossary) {
    if (!all.has(term.link)) issues.push("glossary " + term.term + ": missing link " + term.link);
  }
  for (const item of site.gallery) {
    if (!item.cover && !all.has(item.entity)) issues.push("gallery " + item.id + ": missing entity " + item.entity);
  }

  const report = {
    counts: {
      works: site.works.length,
      parts: site.parts.length,
      chapters: site.chapters.length,
      fullChapters: site.chapters.filter((chapter) => chapter.text).length,
      characters: site.characters.length,
      locations: site.locations.length,
      corporations: site.corporations.length,
      implants: site.implants.length,
      weapons: site.weapons.length,
      glossary: site.glossary.length,
      gallery: site.gallery.length
    },
    chapters,
    distributions: {
      chapterStatus: countBy(site.chapters, "status"),
      chapterPov: countBy(site.chapters, "pov"),
      chapterDay: countBy(site.chapters, "day"),
      galleryType: countBy(site.gallery, "type")
    },
    portraits: {
      open: site.characters.filter((item) => item.portrait).map((item) => item.name),
      fallback: site.characters.filter((item) => !item.portrait).map((item) => item.name)
    },
    issues
  };

  const jsonPath = path.join(os.tmpdir(), "solyanoy-content-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  const header = ["n", "title", "part", "pov", "day", "status", "words", "synopsisChars"];
  const csv = [
    header.map(csvCell).join(","),
    ...chapters.map((row) => header.map((key) => csvCell(row[key])).join(","))
  ].join("\n");
  const csvPath = path.join(os.tmpdir(), "solyanoy-chapters.csv");
  fs.writeFileSync(csvPath, csv, "utf8");

  console.log("CONTENT", report.counts);
  console.log("Статусы глав:", report.distributions.chapterStatus);
  console.log("POV:", report.distributions.chapterPov);
  console.log("Портреты без фото:", report.portraits.fallback.join(", "));
  console.log("JSON:", jsonPath);
  console.log("CSV:", csvPath);
  if (issues.length) {
    console.error("Проблемы контента:", issues.length);
    for (const issue of issues) console.error("-", issue);
    process.exit(1);
  }
}

main();
