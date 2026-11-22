# PROJECT-META — «Соляной протокол» (DaroSite)

Статический артбук-архив романа: мрачный биотех-детектив о городе Кассий.
Статика без сборщика — HTML в корне, `assets/{art,audio,css,fonts,js}`,
открывается напрямую через `index.html`. Node нужен только проверкам (`tools/`).

## Карта репо

- 17 страниц: index, library, book, chapter (читалка), world, characters,
  corporations, implants, weapons, locations, map, graph, dossier, gallery,
  about, pitch (питч издателям), 404.
- assets/: art 16M, audio 1.9M, js 1.1M, css 716K, fonts (IBM Plex, OFL.txt).
- tools/: 17 QA-скриптов (check, qa, mobile, interactions, seo, crawl…).
- robots.txt, sitemap.xml, .nojekyll есть. CI и деплой-пайплайна нет (до 2026-11-22).

## Деплой

GitHub Pages, проектный путь `/DaroSite/`: canonical/og/sitemap — абсолютные
URL `https://darkdaro.github.io/DaroSite/`, 404.html — корневые ссылки
`/DaroSite/…` (правильно для 404 под проектным путём). CI:
`.github/workflows/deploy.yml` — гейты → чистая копия в `out/` (без tools/,
scripts/, rules/, *.md, package.json, opencode.json) → Pages.

## Правила

- Точка входа агента — `AGENTS.md`; правила в `rules/`; гейты — `scripts/`.
- Коммиты: `тема: что; деталь; чем проверено` (rules/commits.md). История
  до 2026-11-22 — старый стиль («Добавить …»), не переписывать.

## Состояние на 2026-11-22

- Контент полон: 34 главы, 71 733 слова (детали — README.md).
- Гейты на входе: слоп — 0 находок на 22 файлах; ссылки — чисто после
  фикса двух системных случаев (data: URI с запятыми, `--base /DaroSite/`).
