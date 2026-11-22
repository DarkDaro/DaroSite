#!/usr/bin/env node
/* ============================================================
   check-links.mjs — линтер внутренних ссылок статики.
   Сайт живёт на GitHub Pages под проектным путём /DaroSite/,
   поэтому проверки идут ДО деплоя: битая ссылка ломает
   публикацию раньше, чем читатель увидит 404.

   Что проверяет во всех *.html:
   1. href/src/srcset/poster, кроме внешних (http/https,//,mailto,
      tel:,data:,javascript:) — файл существует.
   2. Якоря: #id существует в том же или указанном файле
      (id="…" или <a name="…">).
   3. srcset — каждый кандидат из списка.
   4. Абсолютные пути: при --base "/DaroSite/" валидны только
      ссылки, начинающиеся с этого префикса (обрезаются и
      проверяются от корня репо); остальные абсолютные пути на
      Pages под проектным путём отдают 404 — считаются ошибкой.
   5. data:-URI пропускаются целиком: запятые внутри них —
      не разделители списка (favicon в виде inline-SVG).

   Запуск:            node scripts/check-links.mjs [каталог]
   По умолчанию:      текущий каталог (сайт в корне репо)
   Базовый префикс:   --base /DaroSite/
   Исключить каталоги: --ignore out,vendor,node_modules
   Коды выхода:       0 — чисто, 1 — есть ошибки.
   Без зависимостей, plain node.
   ============================================================ */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

/* ---------- аргументы ---------- */

const argv = process.argv.slice(2);
let target = ".";
let base = "";
const ignoreRaw = new Set([
  ".git", "node_modules", "out", ".github", "scripts", "rules", "tools",
  "vendor",
]);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--ignore") {
    for (const d of (argv[i + 1] ?? "").split(",")) {
      const t = d.trim();
      if (t) ignoreRaw.add(t);
    }
    i++;
  } else if (argv[i] === "--base") {
    base = argv[i + 1] ?? "";
    i++;
  } else {
    target = argv[i];
  }
}
// база приводится к виду "/префикс/"
if (base && !base.startsWith("/")) base = "/" + base;
if (base && !base.endsWith("/")) base += "/";
const root = resolve(target);

/* ---------- сбор html-файлов ---------- */

const errors = [];
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    if (ignoreRaw.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(html?|xhtml)$/i.test(entry)) files.push(full);
  }
};
walk(root);
if (files.length === 0) {
  console.error(`check-links: в ${root} нет *.html — проверять нечего (не тот каталог?)`);
  process.exit(1);
}

/* ---------- регулярки атрибутов ---------- */

const attrRe =
  /\b(href|src|poster)\s*=\s*"([^"]*)"|\b(href|src|poster)\s*=\s*'([^']*)'/gi;
const srcsetRe = /\bsrcset\s*=\s*"([^"]*)"|\bsrcset\s*=\s*'([^']*)'/gi;
const idRe = /\bid\s*=\s*["']([^"']+)["']/gi;
const nameRe = /\bname\s*=\s*["']([^"']+)["']/gi;

const SKIP_RE =
  /^(https?:|\/\/|mailto:|tel:|data:|javascript:|\{\{|\$\{|\?)/i;
const DATA_RE = /^data:/i;
const anchorIds = new Map(); // файл -> Set(id)

function safeDecode(ref) {
  try {
    return decodeURIComponent(ref);
  } catch {
    return ref;
  }
}

function idsOf(file) {
  if (!anchorIds.has(file)) {
    const src = readFileSync(file, "utf8");
    const ids = new Set();
    let m;
    while ((m = idRe.exec(src)) !== null) ids.add(m[1]);
    while ((m = nameRe.exec(src)) !== null) ids.add(m[1]);
    anchorIds.set(file, ids);
  }
  return anchorIds.get(file);
}

let checked = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const rel = file.slice(root.length + 1);

  const scan = (re, getVal) => {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split("\n").length;
      const val = getVal(m);
      if (!val) continue;
      // data:-URI целиком: запятые внутри URI — не разделители списка
      const trimmedVal = val.trim();
      if (DATA_RE.test(trimmedVal)) continue;
      for (const cand of trimmedVal.split(",")) {
        const rawRef = cand.trim().split(/\s+/)[0];
        if (!rawRef || rawRef === "#" || SKIP_RE.test(rawRef)) continue;
        const ref = safeDecode(rawRef);
        checked++;
        const [pathRaw, hash] = ref.split("#");
        const path = pathRaw.split("?")[0];

        let targetFile;
        if (path.startsWith("/")) {
          // абсолютный путь: под проектным путём Pages валиден только
          // префикс базового пути, остальное — гарантированный 404
          if (!base || !path.startsWith(base)) {
            errors.push(
              `${rel}:${line} — "${ref}" абсолютный путь вне --base ${base}: на Pages отдаст 404`
            );
            continue;
          }
          let relPath = path.slice(base.length);
          if (!relPath || relPath.endsWith("/")) relPath += "index.html";
          targetFile = resolve(root, relPath);
        } else {
          targetFile = path ? resolve(dirname(file), path) : file;
        }

        if (hash) {
          let ids;
          try {
            ids = idsOf(targetFile);
          } catch {
            ids = null;
          }
          if (ids && !ids.has(hash)) {
            errors.push(
              `${rel}:${line} — якорь "#${hash}" не найден в ${path || "этом файле"}`
            );
          }
        }
        if (!existsSync(targetFile) || !statSync(targetFile).isFile()) {
          errors.push(`${rel}:${line} — "${ref}" не существует`);
        }
      }
    }
  };

  scan(attrRe, (m) => m[2] ?? m[4]);
  scan(srcsetRe, (m) => m[1] ?? m[2]);
}

/* ---------- итог ---------- */

if (errors.length) {
  for (const e of errors) console.error(`ОШИБКА: ${e}`);
  console.error(`\ncheck-links: ${errors.length} ошибок.`);
  process.exit(1);
}
console.log(
  `check-links: OK — страниц ${files.length}, ссылок/ресурсов проверено ${checked}.`
);
