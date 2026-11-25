import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const BASE = "https://darkdaro.github.io/DaroSite/";
const TODAY = new Date().toISOString().slice(0, 10);
const IMAGE_WIDTH = 1280;

// Обложка раздела: свои og:image вместо единой пластины.
// Размеры считаются из data.js (ratio пластины), не задаются вручную.
const DEFAULT_IMAGE = { file: "dam-fog", alt: "Стеклянная дамба в тумане" };
const PAGE_IMAGES = {
  "index.html": { file: "dam-fog", alt: "Стеклянная дамба в тумане" },
  "book.html": { file: "dam-fog", alt: "Стеклянная дамба в тумане" },
  "pitch.html": { file: "weave-board", alt: "Полотно: плата со следами тепла" },
  "chapter.html": { file: "tokyo-rain", alt: "Ночной дождь в городе" },
  "characters.html": { file: "kira", alt: "Портрет Киры", width: 1200 },
  "dossier.html": { file: "archive", alt: "Архивные полки" },
  "locations.html": { file: "port-night", alt: "Порт в ночи" },
  "map.html": { file: "nyc-night", alt: "Город с высоты в ночи" },
  "graph.html": { file: "hk-neon", alt: "Неоновые вывески города" },
  "corporations.html": { file: "z9-factory", alt: "Промышленный цех" },
  "implants.html": { file: "clinic-ampoules", alt: "Ампулы в клинике" },
  "weapons.html": { file: "hologram-soldier", alt: "Голограмма солдата" },
  "gallery.html": { file: "neon-shinjuku", alt: "Неоновая улица в дождь" },
  "library.html": { file: "archive", alt: "Архивные полки" },
  "world.html": { file: "city-torley", alt: "Городские ярусы" },
  "about.html": { file: "station-zero", alt: "Станция в старом метро" }
};

function ogImageFor(file) {
  const pick = PAGE_IMAGES[file] || DEFAULT_IMAGE;
  const record = SITE.images[pick.file];
  if (!record) throw new Error("нет пластины в data.js: " + pick.file);
  const width = pick.width || IMAGE_WIDTH;
  const height = Math.round(width / record.ratio);
  return {
    url: BASE + "assets/art/" + pick.file + "-" + width + ".webp",
    width: String(width),
    height: String(height),
    alt: pick.alt
  };
}

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
  const graph = [{
    "@type": "WebPage",
    name: title,
    description,
    url: canonical,
    inLanguage: "ru",
    isPartOf: { "@type": "WebSite", name: "Соляной протокол", url: BASE }
  }];

  const book = {
    "@type": "Book",
    name: SITE.meta.title || "Соляной протокол",
    author: { "@type": "Person", name: SITE.meta.author || "Илья Верес" },
    inLanguage: "ru",
    datePublished: String(SITE.meta.year || "2026"),
    description: SITE.meta.logline || description,
    url: BASE + "book.html",
    image: BASE + "assets/art/dam-fog-1280.webp"
  };

  if (file === "index.html") {
    graph.push({ "@type": "WebSite", name: "Соляной протокол", url: BASE, inLanguage: "ru", description });
    graph.push(book);
  }
  if (file === "book.html") graph.push(book);
  if (file === "about.html") {
    graph.push({
      "@type": "Person",
      name: SITE.meta.author || "Илья Верес",
      description: SITE.pitch.authorShort || description,
      url: canonical
    });
  }

  return '<script type="application/ld+json">' + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) + "</script>";
}

function seoBlock(file, title, description, canonical) {
  const type = file === "book.html" ? "book" : file === "pitch.html" ? "article" : "website";
  const image = ogImageFor(file);
  const tags = [
    '<link rel="canonical" href="' + attr(canonical) + '">',
    '<link rel="alternate" hreflang="ru" href="' + attr(canonical) + '">',
    '<link rel="alternate" hreflang="x-default" href="' + attr(canonical) + '">',
    '<link rel="sitemap" type="application/xml" href="' + BASE + 'sitemap.xml">',
    '<meta name="author" content="' + attr(SITE.meta.author || "Илья Верес") + '">',
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">',
    '<meta property="og:locale" content="ru_RU">',
    '<meta property="og:site_name" content="Соляной протокол">',
    '<meta property="og:type" content="' + type + '">',
    '<meta property="og:title" content="' + attr(title) + '">',
    '<meta property="og:description" content="' + attr(description) + '">',
    '<meta property="og:url" content="' + attr(canonical) + '">',
    '<meta property="og:image" content="' + attr(image.url) + '">',
    '<meta property="og:image:width" content="' + image.width + '">',
    '<meta property="og:image:height" content="' + image.height + '">',
    '<meta property="og:image:alt" content="' + attr(image.alt) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    '<meta name="twitter:title" content="' + attr(title) + '">',
    '<meta name="twitter:description" content="' + attr(description) + '">',
    '<meta name="twitter:image" content="' + attr(image.url) + '">',
    '<meta name="twitter:image:alt" content="' + attr(image.alt) + '">'
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
    next = next.replace(/\n\s*\n\s*(<\/head>)/, "\n$1");
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
