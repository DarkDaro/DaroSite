# Node-инструменты сайта

Все команды запускаются из `C:\Site`. Python не нужен.

## Быстрая работа

```powershell
npm run quick
```

Проверяет синтаксис, пять ключевых страниц на desktop и mobile, overflow, битые изображения, console errors и внешние запросы. Занимает несколько секунд. Используйте во время правок.

## Полная проверка

```powershell
npm test
```

Запускает по очереди:

1. `npm run check` — данные, главы, ссылки, изображения, синтаксис.
2. `npm run qa` — 18 маршрутов на desktop и mobile.
3. `npm run mobile` — 18 маршрутов на 320, 360, 390, 430 и 768 px.
4. `npm run interactions` — меню, поиск, фильтры, шрифт читалки, кнопка наверх, липкая шапка.

Полный прогон нужен перед коммитом. Для мелкой правки достаточно `npm run quick`.

Playwright-проверки закрывают браузер и локальный сервер с таймаутом. Если соединение зависло, процесс не ждёт бесконечно.

## Отдельные команды

| Команда | Что делает |
|---|---|
| `npm run serve` | Локальный сервер на `http://127.0.0.1:8765/` |
| `npm run quick` | Быстрый smoke-тест |
| `npm run check` | Проверка данных и синтаксиса |
| `npm run content` | Разбор контента, JSON и CSV по главам |
| `npm run html` | Аудит HTML-оболочек через `cheerio` |
| `npm run assets` | Аудит WebP через `sharp` |
| `npm run crawl` | Обход внутренних ссылок и поиск 404 |
| `npm run shot -- /index.html 390` | Скриншот маршрута |
| `npm run qa` | 18 маршрутов, desktop и mobile |
| `npm run mobile` | 5 ширин экрана, 90 проверок |
| `npm run interactions` | 11 интерактивных проверок |
| `npm run audit` | Контент, HTML, ассеты и обход ссылок |

## Файлы

| Файл | Назначение |
|---|---|
| `server.mjs` | Статический сервер без зависимостей |
| `serve.mjs` | Запуск сервера на порту 8765 |
| `global.mjs` | Подключение глобальных пакетов Node |
| `check.mjs` | Проверка `data.js`, ссылок и ассетов |
| `content.mjs` | Разбор контента и экспорт JSON/CSV |
| `html.mjs` | Аудит HTML через `cheerio` |
| `assets.mjs` | Аудит изображений через `sharp` |
| `crawl.mjs` | Обход ссылок через Playwright |
| `shot.mjs` | Скриншот маршрута |
| `qa.mjs` | Полный QA по маршрутам |
| `mobile.mjs` | Мобильный адаптив и тап-зоны |
| `interactions.mjs` | Интерактив в мобильном размере |
| `quick.mjs` | Быстрый smoke-тест |

Отчёты пишутся в `%TEMP%`:

- `solyanoy-quick-report.json`
- `solyanoy-content-report.json`
- `solyanoy-chapters.csv`
- `solyanoy-html-report.json`
- `solyanoy-assets-report.json`
- `solyanoy-crawl-report.json`
- `solyanoy-qa-report.json`
- `solyanoy-mobile-report.json`
- `solyanoy-interactions-report.json`
- `solyanoy-shot-*.png`

## Правила

- Не добавлять локальные `node_modules`, если хватает глобальных пакетов.
- Новые Node-инструменты писать как `.mjs`.
- Браузерные скрипты сайта остаются `.js`.
- При добавлении нового маршрута обновить `qa.mjs` и `mobile.mjs`.
- При изменении мобильной вёрстки сначала запускать `npm run mobile`, потом `npm test`.
