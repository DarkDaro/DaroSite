import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const BASE = "https://darkdaro.github.io/DaroSite/";
const TODAY = "2026-10-26";
const IMAGE = BASE + "assets/art/dam-fog-1280.webp";

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, "assets/js/data.js"), "utf8"), context);
const SITE = context.window.SITE;

const pageFiles = fs.readdirSync(ROOT).filter((name) => name.endsWith(".html") && name !== "404.html").sort();

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(ROOT, file), text, "utf8");
}

function attr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xml(value) {
  return attr(value);
}

function pageTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "Соляной протокол";
}

function pageDescription(html) {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return match ? match[1].trim() : "Артбук и архив романа «Соляной протокол».";
}

function canonicalFor(file) {
  if (file === "index.html") return BASE;
  return BASE + file;
}

function jsonLdFor(file, title, description, canonical) {
  if (file !== "index.html" && file !== "book.html") return "";

  const book = {
    "@type": "Book",
    name: SITE.meta.title || "Соляной протокол",
    author: { "@type": "Person", name: SITE.meta.author || "Илья Верес" },
    inLanguage: "ru",
    datePublished: String(SITE.meta.year || "2026"),
    description: SITE.meta.logline || description,
    url: BASE + "book.html",
    image: IMAGE
  };

  const data = file === "index.html"
    ? {
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", name: title, url: BASE, inLanguage: "ru", description },
          book
        ]
      }
    : {
        "@context": "https://schema.org",
        "@graph": [book]
      };

  return '<script type="application/ld+json">' + JSON.stringify(data) + "</script>";
}

function seoBlock(file, title, description, canonical) {
  const type = file === "book.html" ? "book" : file === "pitch.html" ? "article" : "website";
  const tags = [
    '<link rel="canonical" href="' + attr(canonical) + '">',
    '<meta property="og:locale" content="ru_RU">',
    '<meta property="og:site_name" content="Соляной протокол">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:title" content="' + attr(title) + '">',
    '<meta property="og:description" content="' + attr(description) + '">',
    '<meta property="og:url" content="' + attr(canonical) + '">',
    '<meta property="og:image" content="' + attr(IMAGE) + '">',
    '<meta property="og:image:alt" content="Стеклянная дамба в тумане">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + attr(title) + '">',
    '<meta name="twitter:description" content="' + attr(description) + '">',
    '<meta name="twitter:image" content="' + attr(IMAGE) + '">'
  ];
  if (file === "book.html") {
    tags.push('<meta property="book:author" content="' + attr(SITE.meta.author || "Илья Верес") + '">');
    tags.push('<meta property="book:release_date" content="' + attr(String(SITE.meta.year || "2026")) + '">');
  }
  const jsonLd = jsonLdFor(file, title, description, canonical);
  if (jsonLd) tags.push(jsonLd);
  return "\n<!-- seo:start -->\n" + tags.join("\n") + "\n<!-- seo:end -->\n";
}

let updated = 0;
for (const file of pageFiles) {
  const html = read(file);
  const title = pageTitle(html);
  const description = pageDescription(html);
  const canonical = canonicalFor(file);
  const block = seoBlock(file, title, description, canonical);
  const start = "<!-- seo:start -->";
  const end = "<!-- seo:end -->";
  const startAt = html.indexOf(start);
  const endAt = html.indexOf(end);
  let next;
  if (startAt >= 0 && endAt > startAt) {
    next = html.slice(0, startAt) + block.slice(1) + html.slice(endAt + end.length);
  } else {
    next = html.replace("</head>", block + "</head>");
  }
  if (next !== html) {
    write(file, next);
    updated += 1;
  }
}

const sitemapPages = [
  ["", "1.0", "weekly"],
  ["book.html", "0.9", "weekly"],
  ["pitch.html", "0.8", "monthly"],
  ["about.html", "0.7", "monthly"],
  ["characters.html", "0.7", "monthly"],
  ["locations.html", "0.7", "monthly"],
  ["world.html", "0.7", "monthly"],
  ["map.html", "0.7", "monthly"],
  ["graph.html", "0.7", "monthly"],
  ["gallery.html", "0.7", "monthly"],
  ["library.html", "0.6", "monthly"],
  ["corporations.html", "0.5", "monthly"],
  ["implants.html", "0.5", "monthly"],
  ["weapons.html", "0.5", "monthly"]
];

const urls = sitemapPages.map(([file, priority, changefreq]) => ({
  loc: BASE + file,
  priority,
  changefreq
}));

for (const chapter of SITE.chapters) {
  urls.push({
    loc: BASE + "chapter.html?n=" + chapter.n,
    priority: "0.6",
    changefreq: "monthly"
  });
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((item) =>
    "  <url>\n" +
    "    <loc>" + xml(item.loc) + "</loc>\n" +
    "    <lastmod>" + TODAY + "</lastmod>\n" +
    "    <changefreq>" + item.changefreq + "</changefreq>\n" +
    "    <priority>" + item.priority + "</priority>\n" +
    "  </url>"
  ).join("\n") +
  "\n</urlset>\n";

const robots = [
  "User-agent: *",
  "Allow: /",
  "Disallow: /docs/",
  "Disallow: /tools/",
  "Disallow: /exports/",
  "Disallow: /package.json",
  "Disallow: /opencode.json",
  "Disallow: /anti-slop",
  "Disallow: /README.md",
  "",
  "Sitemap: " + BASE + "sitemap.xml",
  ""
].join("\n");

write("sitemap.xml", sitemap);
write("robots.txt", robots);
write(".nojekyll", "");

console.log("SEO", { pages: pageFiles.length, updated, sitemapUrls: urls.length });
