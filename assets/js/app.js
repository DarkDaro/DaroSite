/* Страницы архива. Классический скрипт, без модулей и сетевых запросов. */

(function () {
  "use strict";

  var SITE = window.SITE;
  var U = window.Util;
  var main = document.getElementById("main");
  var page = document.body.dataset.page || "home";
  var esc = U.esc;

  var imageLabels = {
    "tokyo-rain": "Токио, дождь",
    "hk-street": "Гонконг, ночная улица",
    "hk-neon": "Неоновые вывески",
    "nyc-night": "Ночной город",
    "dam-fog": "Мост в тумане",
    "port-night": "Порт ночью",
    "salt-fields": "Соляные поля",
    "station-zero": "Тоннель метро",
    "archive": "Серверные стойки",
    "z9-town": "Оставленный город",
    "z9-factory": "Затопленный цех",
    "weave-board": "Печатная плата",
    "clinic-ampoules": "Ампулы в шкафу",
    "docks": "Портовые краны",
    "quiet": "Фигура в свете",
    "silhouette": "Силуэт у неона",
    "kira": "Портрет № 14",
    "nora": "Портрет № 21",
    "ada": "Портрет № 08",
    "teo": "Портрет № 03",
    "mark": "Портрет № 00"
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function norm(value) {
    return String(value == null ? "" : value).toLowerCase().replace(/ё/g, "е");
  }

  function byName(a, b) {
    return String(a.name).localeCompare(String(b.name), "ru");
  }

  function statusClass(status) {
    var value = norm(status);
    if (/опубликовано|издан|действует|жив|жива|открыт|разрешён/.test(value)) return "status--live";
    if (/удалён|закрыт|запрещён|не подтверждён|мёртв/.test(value)) return "status--dead";
    return "";
  }

  function badge(status) {
    return '<span class="status ' + statusClass(status) + '">' + esc(status) + "</span>";
  }

  function findChapter(n) {
    return SITE.chapters.find(function (chapter) { return chapter.n === Number(n); });
  }

  function findCharacter(id) {
    return SITE.characters.find(function (item) { return item.id === id; });
  }

  function findLocation(id) {
    return SITE.locations.find(function (item) { return item.id === id; });
  }

  function findCorp(id) {
    return SITE.corporations.find(function (item) { return item.id === id; });
  }

  function findImplant(id) {
    return SITE.implants.find(function (item) { return item.id === id; });
  }

  function findWeapon(id) {
    return SITE.weapons.find(function (item) { return item.id === id; });
  }

  function findEntity(id) {
    if (!id) return null;
    var char = findCharacter(id);
    if (char) return { kind: "character", item: char };
    var location = findLocation(id);
    if (location) return { kind: "location", item: location };
    var corp = findCorp(id);
    if (corp) return { kind: "corporation", item: corp };
    var implant = findImplant(id);
    if (implant) return { kind: "implant", item: implant };
    var weapon = findWeapon(id);
    if (weapon) return { kind: "weapon", item: weapon };
    return null;
  }

  function entityUrl(id) {
    return findEntity(id) ? U.dossierUrl(id) : "#";
  }

  function entityName(id) {
    var found = findEntity(id);
    return found ? found.item.name : id;
  }

  function entityKindLabel(kind) {
    return { character: "Досье", location: "Локация", corporation: "Организация", implant: "Имплантат", weapon: "Вооружение" }[kind] || "Материал";
  }

  function sectionHead(number, title) {
    return '<div class="section-head"><span class="num">' + esc(number) + "</span><h2>" + esc(title) + "</h2></div>";
  }

  function pageHead(eyebrow, title, lead, meta) {
    return '<header class="page-head"><div class="wrap"><p class="eyebrow">' + esc(eyebrow) + "</p><h1>" + esc(title) + "</h1>" +
      (lead ? '<p class="lead">' + esc(lead) + "</p>" : "") +
      (meta ? '<div class="page-head-meta">' + meta.map(function (item) { return '<span class="meta">' + esc(item) + "</span>"; }).join("") + "</div>" : "") +
      "</div></header>";
  }

  function crumbs(items) {
    return '<nav class="crumbs meta" aria-label="Хлебные крошки">' + items.map(function (item, i) {
      return (i ? "<span>/</span>" : "") + '<a href="' + item.href + '">' + esc(item.label) + "</a>";
    }).join("") + "</nav>";
  }

  function seamBlock(text) {
    if (!text) return "";
    return '<div class="wrap"><p class="seam"><b>Слой 2.</b> ' + esc(text) + "</p></div>";
  }

  function tocItem(chapter) {
    return '<a class="toc-item" href="' + U.chapterUrl(chapter.n) + '"><span class="n">' + pad(chapter.n) + '</span><span class="t">' + esc(chapter.title) + '</span><span class="s">' + esc(chapter.status) + "</span></a>";
  }

  function infoCard(title, text) {
    return '<article class="info-card"><h3>' + esc(title) + '</h3><p class="meta meta--plain">' + esc(text) + "</p></article>";
  }

  function characterCard(item) {
    var visual = item.portrait
      ? U.plate(item.portrait, { alt: item.name, cls: "plate--tall", focus: item.focus, sizes: "(max-width: 680px) 100vw, (max-width: 1100px) 33vw, 25vw" })
      : '<span class="plate plate--tall portrait-fallback"><span class="pf-mark">' + esc(initials(item.name)) + '</span><span class="pf-label">портрет не открыт</span></span>';
    return '<a class="card character-card" href="' + U.dossierUrl(item.id) + '"><span class="character-visual">' + visual +
      '<span class="character-status">' + badge(item.status) + "</span></span>" +
      "<h3>" + esc(item.name) + '</h3><span class="card-sub">' + esc(item.role) + '</span><span class="meta">' + esc(item.faction) + " / гл. " + item.firstChapter + "</span></a>";
  }

  function characterRow(item, i) {
    return '<a class="index-row" href="' + U.dossierUrl(item.id) + '"><span class="n">' + pad(i + 1) + '</span><span class="t">' + esc(item.name) + '</span><span class="d">' + esc(item.role) + ", " + esc(item.faction) + '</span><span class="m">' + esc(item.status) + " / гл. " + item.firstChapter + "</span></a>";
  }

  function initials(name) {
    return String(name).split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join("");
  }

  function locationCard(item) {
    return '<a class="card" href="' + U.dossierUrl(item.id) + '">' +
      U.plate(item.img, { alt: item.name, cls: "plate--wide", focus: item.focus, sizes: "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw" }) +
      "<h3>" + esc(item.name) + '</h3><span class="card-sub">' + esc(item.tier) + " / " + esc(item.control) + '</span><span class="meta">' + esc(item.access) + "</span></a>";
  }

  function orgCard(item) {
    return '<a class="org-card" href="' + U.dossierUrl(item.id) + '"><span class="org-seal" aria-hidden="true">' + esc(initials(item.name)) + '</span><span class="org-body"><span class="eyebrow">' + esc(item.sector) + "</span><h3>" + esc(item.name) + "</h3><p>" + esc(item.summary) + '</p><span class="meta">' + esc(item.status) + " / " + esc(item.founded) + "</span></span></a>";
  }

  function galleryFigure(item, options) {
    options = options || {};
    var ratio = item.ratio === "wide" ? "plate--wide" : "plate--tall";
    var inner = item.cover
      ? U.cover(item.cover)
      : U.img(item.img, { alt: item.title, focus: item.focus, sizes: options.sizes || "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 40vw" });
    var button = '<button class="plate ' + (item.cover ? "cover-plate" : ratio) + '" type="button" data-lightbox="' + item.id + '" aria-label="Открыть пластину: ' + esc(item.title) + '">' + inner + "</button>";
    var link = options.link ? '<a class="plate ' + (item.cover ? "cover-plate" : ratio) + '" href="' + options.link + '" aria-label="' + esc(item.title) + '">' + inner + "</a>" : button;
    return '<figure class="gallery-item span-' + item.span + '">' + link + '<figcaption><span class="g-title">' + esc(item.title) + '</span><span class="g-meta">' + esc(item.note) + "</span></figcaption></figure>";
  }

  function chapterNotes(chapter) {
    var notes = [];
    SITE.glossary.forEach(function (term) {
      if (term.chapters.indexOf(chapter.n) !== -1) notes.push({ type: "Термин", title: term.term, href: "world.html#term-" + (SITE.glossary.indexOf(term) + 1) });
    });
    SITE.characters.forEach(function (item) {
      if (item.firstChapter === chapter.n) notes.push({ type: "Досье", title: item.name, href: U.dossierUrl(item.id) });
    });
    SITE.locations.forEach(function (item) {
      if (item.firstChapter === chapter.n) notes.push({ type: "Локация", title: item.name, href: U.dossierUrl(item.id) });
    });
    return notes;
  }

  function textWords(text) {
    return text ? text.split(/\s+/).filter(Boolean).length : 0;
  }

  function readingTime(text) {
    return Math.max(1, Math.round(textWords(text) / 180));
  }

  function paragraphs(text) {
    return text.split(/\n\s*\n/).map(function (part) { return part.trim(); }).filter(Boolean).map(function (part) {
      return "<p>" + esc(part.replace(/\n/g, " ")) + "</p>";
    }).join("");
  }

  function notFound(message) {
    main.innerHTML = pageHead("404 / архив", "Материал не найден", message || "В архиве нет такой записи. Возможно, она удалена или ещё не описана.") +
      '<section class="section"><div class="wrap"><a class="link-arrow" href="index.html">На главную</a> <a class="link-arrow" href="library.html">В библиотеку</a></div></section>';
    document.title = "Материал не найден / Соляной протокол";
  }

  /* Главная */

  function renderHome() {
    var first = SITE.chapters.slice(0, 8);
    var worldLinks = [
      { label: "Персонажи", href: "characters.html", count: SITE.characters.length, num: "01" },
      { label: "Локации", href: "locations.html", count: SITE.locations.length, num: "02" },
      { label: "Организации", href: "corporations.html", count: SITE.corporations.length, num: "03" },
      { label: "Имплантаты", href: "implants.html", count: SITE.implants.length, num: "04" },
      { label: "Вооружение", href: "weapons.html", count: SITE.weapons.length, num: "05" }
    ];
    var homeGallery = ["g01", "g05", "g08", "g09"].map(function (id) { return SITE.gallery.find(function (item) { return item.id === id; }); }).filter(Boolean);

    main.innerHTML =
      '<section class="cover"><div class="wrap">' +
        '<div class="cover-top"><span class="meta">Архив Кассия / 2026</span><span class="meta">Роман / 34 главы / слой 2</span></div>' +
        '<div class="signal-strip" aria-hidden="true"><div class="signal-track">' +
          ["Дождь по расписанию", "Соль в вентиляции", "Полотно активно", "Допуск отозван", "Точка впрыска 34", "Дождь по расписанию", "Соль в вентиляции", "Полотно активно", "Допуск отозван", "Точка впрыска 34"].map(function (text) { return "<span>" + text + "</span>"; }).join("") +
        "</div></div>" +
        '<div class="grid cover-grid">' +
          '<div class="cover-text"><div>' +
            '<h1 class="cover-title"><span>Соляной</span><span class="second">протокол</span></h1>' +
            '<div class="cover-sub"><span class="eyebrow">роман</span><span class="meta">Илья Верес</span><span class="meta">2026</span><span class="meta">демонстрационный материал</span></div>' +
            '<blockquote class="cover-epigraph">«Дождь идёт по расписанию. Соль не спрашивает.»<cite>Из служебной записки «Тихого Света»</cite></blockquote>' +
          "</div>" +
          '<div class="cover-actions"><a class="link-arrow" href="book.html">Открыть книгу</a><a class="link-arrow" href="chapter.html?n=1">Читать первую главу</a></div>' +
          "</div>" +
          '<div class="cover-side"><div class="cover-image">' +
            U.img("dam-fog", { alt: "Стеклянная дамба в тумане", loading: "eager", sizes: "(max-width: 900px) 100vw, 42vw" }) +
            '<div class="cover-image-label"><span class="big">Стеклянная дамба</span><span class="meta">Кассий / 04:20</span></div>' +
          '</div><div class="cover-imprint"><span class="meta">том I</span><span class="meta">из архива «Тихий Свет»</span></div></div>' +
        "</div>" +
        '<span class="cover-mark">архив / роман / Кассий</span>' +
      "</div></section>" +

      '<section class="section"><div class="wrap">' +
        sectionHead("01 / роман", "Город, который дышит по расписанию") +
        '<div class="note"><div><p class="eyebrow">аннотация</p><p class="meta mt-16">Кассий, 2026</p><p class="meta">Роман в трёх частях</p><p class="meta">34 главы</p><p class="seam">' + esc(SITE.seams.home) + "</p></div>" +
        '<div class="note-body"><p class="lead">' + esc(SITE.meta.annotation) + '</p><div class="card-grid card-grid--3 mt-32">' +
          SITE.meta.blocks.map(function (block) { return infoCard(block.title, block.text); }).join("") +
        "</div></div></div>" +
      "</div></section>" +

      '<section class="section"><div class="wrap">' +
        sectionHead("02 / содержание", "Первые восемь глав") +
        '<div class="toc">' + first.map(tocItem).join("") + "</div>" +
        '<div class="mt-24"><a class="link-arrow" href="book.html#contents">Полное содержание</a></div>' +
      "</div></section>" +

      '<section class="section"><div class="wrap">' +
        sectionHead("03 / мир", "Пять входов в Кассий") +
        '<div class="world-cats">' + worldLinks.map(function (item) {
          return '<a class="world-cat" href="' + item.href + '"><span class="num">' + item.num + "</span><h3>" + esc(item.label) + '</h3><span class="meta">' + item.count + " " + U.plural(item.count, ["запись", "записи", "записей"]) + "</span></a>";
        }).join("") + "</div>" +
      "</div></section>" +

      '<section class="section"><div class="wrap">' +
        sectionHead("04 / пластины", "Контактный лист") +
        '<div class="gallery-grid">' + homeGallery.map(function (item) { return galleryFigure(item, { link: "gallery.html#" + item.id }); }).join("") + "</div>" +
        '<div class="mt-24"><a class="link-arrow" href="gallery.html">Все пластины</a></div>' +
      "</div></section>" +

      '<section class="section"><div class="wrap note">' +
        '<div><p class="eyebrow">автор</p><h2 class="mt-16">Илья Верес</h2><p class="meta mt-16">Пишет мокрый биотех-детектив и мрачную фантастику.</p><p class="meta">«Соляной протокол» / 2026</p></div>' +
        '<div class="note-body"><p>Мне интересен город, который заботится о человеке до такой степени, что начинает решать за него, чем дышать. В Кассии это доведено до инфраструктуры: воздух стал услугой, услуга стала сетью, сеть стала погодой.</p><p>Я писал эту книгу как архив, а не как пророчество. Здесь есть дождь по расписанию, но нет пророчеств. Только документы, пластины и люди, которые пытаются успеть до дождя.</p><div class="note-sign">Илья Верес / Кассий</div><div class="mt-24"><a class="link-arrow" href="about.html">Об авторе</a></div></div>' +
      "</div></section>" +

      seamBlock(SITE.seams.home);

    document.title = "Соляной протокол. Библиотека автора";
  }

  /* Библиотека */

  function renderLibrary() {
    var works = SITE.works.map(function (work) {
      var link = "book.html?work=" + encodeURIComponent(work.id);
      return '<article class="work-card"><a class="work-cover" href="' + link + '" aria-label="Открыть: ' + esc(work.title) + '">' + U.cover(work.cover) + '</a><div class="work-body"><span class="eyebrow">' + esc(work.type) + " / " + esc(work.year) + "</span><h2>" + esc(work.title) + "</h2><p>" + esc(work.annotation) + '</p><div class="work-meta">' + badge(work.status) + '<span class="meta">' + esc(work.volume) + '</span></div><a class="link-arrow" href="' + link + '">Открыть запись</a></div></article>';
    }).join("");

    var archive = [
      { label: "Персонажи", href: "characters.html", count: SITE.characters.length, text: "Досье, портреты, связи" },
      { label: "Локации", href: "locations.html", count: SITE.locations.length, text: "Ярусы, дно, слой" },
      { label: "Организации", href: "corporations.html", count: SITE.corporations.length, text: "Корпорации, власть, коллективы" },
      { label: "Имплантаты", href: "implants.html", count: SITE.implants.length, text: "Нейро, оптика, тело" },
      { label: "Вооружение", href: "weapons.html", count: SITE.weapons.length, text: "Служебное и кустарное" }
    ];

    main.innerHTML = pageHead("Архив / библиотека", "Книги и материалы", "Роман, сборник, повесть и полевой справочник. Всё, что город успел издать, и то, что ещё лежит в наборе.", ["4 издания", "демонстрационные материалы"]) +
      '<section class="section--tight"><div class="wrap"><div class="library-grid">' + works + "</div></div></section>" +
      '<section class="section"><div class="wrap">' + sectionHead("01 / архив", "Материалы мира") +
        '<div class="index-list">' + archive.map(function (item, i) {
          return '<a class="index-row" href="' + item.href + '"><span class="n">' + pad(i + 1) + '</span><span class="t">' + esc(item.label) + '</span><span class="d">' + esc(item.text) + '</span><span class="m">' + item.count + " " + U.plural(item.count, ["запись", "записи", "записей"]) + "</span></a>";
        }).join("") + "</div></div></section>" +
      seamBlock(SITE.seams.library);

    document.title = "Библиотека / Соляной протокол";
  }

  /* Книга */

  function renderBook() {
    var workId = U.param("work", "sol");
    var work = SITE.works.find(function (item) { return item.id === workId; }) || SITE.works[0];
    if (work.id !== "sol") {
      renderWork(work);
      return;
    }

    var parts = SITE.parts.map(function (part) {
      var chapters = SITE.chapters.filter(function (chapter) { return chapter.part === Number(part.id.replace("part-", "")); });
      return '<div class="part-block"><div class="part-head"><h3>' + esc(part.title) + '</h3><span class="meta">' + esc(part.range) + "</span></div>" + (part.summary ? '<p class="part-note">' + esc(part.summary) + "</p>" : "") + '<div class="toc">' + chapters.map(tocItem).join("") + "</div></div>";
    }).join("");

    var facts = [
      ["Автор", SITE.meta.author],
      ["Год", SITE.meta.year],
      ["Объём", "34 главы, три части"],
      ["Жанр", "биотех-детектив, мрачный триллер"],
      ["Город", SITE.meta.city],
      ["Статус", "издан"]
    ].map(function (row) { return "<tr><th>" + esc(row[0]) + "</th><td>" + esc(row[1]) + "</td></tr>"; }).join("");

    var excerpt = SITE.chapters[0].text ? paragraphs(SITE.chapters[0].text.split(/\n\s*\n/).slice(0, 3).join("\n\n")) : '<p class="meta">Глава 1 в работе. Синопсис доступен в содержании.</p>';

    main.innerHTML = pageHead("Роман / 2026", "Соляной протокол", SITE.meta.annotation, ["Илья Верес", "34 главы", "три части", "демонстрационный материал"]) +
      '<section class="section--tight"><div class="wrap book-hero"><div class="book-hero-cover">' + U.cover("sol") + "</div>" +
        '<div class="book-hero-body"><p class="eyebrow">издание</p><h2>Роман в трёх частях</h2><p class="lead">Город на дамбе, «Соль-7» и женщина, которая подписала собственный приговор.</p>' +
        '<div class="book-actions"><a class="link-arrow" href="chapter.html?n=1">Читать главу 1</a><a class="link-arrow" href="#contents">Содержание</a><a class="link-arrow" href="library.html">Библиотека</a></div>' +
        '<div class="book-facts">' + [
          ["Автор", SITE.meta.author], ["Год", SITE.meta.year], ["Объём", "34 главы"], ["Части", "3"], ["Город", SITE.meta.city], ["Доступно", "1 глава полностью"]
        ].map(function (row) { return '<div class="book-fact"><span class="meta">' + esc(row[0]) + '</span><span class="book-fact-value">' + esc(row[1]) + "</span></div>"; }).join("") + "</div></div></div></section>" +
      '<section class="section"><div class="wrap">' + sectionHead("01 / аннотация", "О чём эта книга") +
        '<div class="card-grid card-grid--3">' + SITE.meta.blocks.map(function (block) { return infoCard(block.title, block.text); }).join("") + "</div></div></section>" +
      '<section class="section" id="contents"><div class="wrap">' + sectionHead("02 / содержание", "Три части, 34 главы") +
        '<div class="part-stack">' + parts + "</div></div></section>" +
      '<section class="section"><div class="wrap grid"><div class="book-edition"><p class="eyebrow">03 / издание</p><h2 class="mt-16">Выходные данные</h2><table class="id-table mt-24">' + facts + '</table><p class="meta mt-24">Демонстрационное издание. Текст, имена и события вымышлены.</p></div>' +
        '<div class="book-excerpt"><p class="eyebrow">фрагмент</p><div class="excerpt mt-16">' + excerpt + '</div><div class="mt-24"><a class="link-arrow" href="chapter.html?n=1">Читать целиком</a></div></div></div></section>' +
      seamBlock(SITE.seams.book);

    document.title = "Соляной протокол / Илья Верес";
  }

  function renderWork(work) {
    var link = work.id === "sol" ? "book.html" : "book.html?work=" + encodeURIComponent(work.id);
    main.innerHTML = pageHead(work.type + " / " + work.year, work.title, work.annotation, [SITE.meta.author, work.status, work.volume, "демонстрационный материал"]) +
      '<section class="section--tight"><div class="wrap book-hero"><div class="book-hero-cover">' + U.cover(work.cover) + "</div>" +
        '<div class="book-hero-body"><p class="eyebrow">издание</p><h2>' + esc(work.type) + " / " + esc(work.year) + "</h2><p class=\"lead\">" + esc(work.annotation) + "</p>" +
        '<div class="book-actions"><a class="link-arrow" href="library.html">В библиотеку</a>' + (work.id === "sol" ? '<a class="link-arrow" href="chapter.html?n=1">Читать главу 1</a>' : '<a class="link-arrow" href="book.html">Соляной протокол</a>') + "</div>" +
        '<div class="book-facts"><div class="book-fact"><span class="meta">Автор</span><span class="book-fact-value">' + esc(SITE.meta.author) + '</span></div><div class="book-fact"><span class="meta">Статус</span><span class="book-fact-value">' + esc(work.status) + '</span></div><div class="book-fact"><span class="meta">Объём</span><span class="book-fact-value">' + esc(work.volume) + '</span></div><div class="book-fact"><span class="meta">Год</span><span class="book-fact-value">' + esc(work.year) + "</span></div></div></div></div></section>" +
      '<section class="section"><div class="wrap"><div class="note"><div><p class="eyebrow">примечание</p><p class="meta mt-16">' + esc(work.status) + "</p></div><div class=\"note-body\"><p>Полный текст этого издания в демонстрационном архиве не опубликован. Запись содержит аннотацию, выходные данные и обложку. Основной роман «Соляной протокол» доступен в разделе «Главы».</p><div class=\"mt-24\"><a class=\"link-arrow\" href=\"" + link + "\">Открыть запись</a></div></div></div></div></section>" +
      seamBlock(SITE.seams.book);

    document.title = work.title + " / Соляной протокол";
  }

  /* Глава */

  function renderChapter() {
    var n = Number(U.param("n", "1"));
    var chapter = findChapter(n);
    if (!chapter) {
      notFound("Такой главы в архиве нет. В романе 34 главы.");
      return;
    }
    var part = SITE.parts[chapter.part - 1];
    var text = chapter.text;
    var prev = findChapter(n - 1);
    var next = findChapter(n + 1);
    var notes = chapterNotes(chapter);
    var full = !!text;
    var body = full
      ? '<div class="reader-text" id="reader-text">' + paragraphs(text) + "</div>"
      : '<div class="empty"><h3>Глава в работе</h3><p>' + esc(chapter.synopsis || "Синопсис пока не написан.") + "</p><p class=\"mt-16\">Полный текст пока доступен только для главы 1. Остальные главы открыты как карточки с синопсисом.</p><div class=\"actions\"><a class=\"link-arrow\" href=\"chapter.html?n=1\">Глава 1</a><a class=\"link-arrow\" href=\"book.html#contents\">К содержанию</a></div></div>";

    main.innerHTML = '<header class="reader-head"><div class="wrap"><p class="chapter-no">' + esc(part.title) + " / глава " + chapter.n + '</p><h1>' + esc(chapter.title) + '</h1><p class="meta">' + esc(chapter.status) + " / " + (full ? textWords(text) + " слов / " + readingTime(text) + " мин" : "синопсис") + " / демонстрационный текст</p></div></header>" +
      '<div class="wrap"><div class="reader-tools"><div class="tool-field"><label>Шрифт</label><button type="button" class="font-step" data-font="-1" aria-label="Уменьшить шрифт">A-</button><button type="button" class="font-step" data-font="1" aria-label="Увеличить шрифт">A+</button></div><div class="tool-field"><label>Текст</label><span class="mono">' + (full ? "полный" : "синопсис") + '</span></div><div class="tool-field"><label>Прогресс</label><span class="mono" id="reader-progress-label">0%</span></div><button type="button" class="filter-toggle" data-print>Печать</button><div class="toolbar-spacer"></div><a class="link-quiet" href="book.html#contents">К содержанию</a></div>' +
      '</div><div class="reader-progress" aria-hidden="true"><span id="reader-progress-bar"></span></div>' +
      '<div class="wrap reader-layout"><div>' + body + '<nav class="reader-nav">' + (prev ? '<a class="link-arrow" href="' + U.chapterUrl(prev.n) + '">' + pad(prev.n) + " / " + esc(prev.title) + "</a>" : "<span></span>") + (next ? '<a class="link-arrow" href="' + U.chapterUrl(next.n) + '">' + pad(next.n) + " / " + esc(next.title) + "</a>" : "<span></span>") + "</nav></div>" +
      '<aside class="reader-notes"><p class="eyebrow">пометки</p>' + (notes.length ? notes.map(function (note) { return '<div class="note-item"><span class="note-no">' + esc(note.type) + '</span><p><a class="link" href="' + note.href + '">' + esc(note.title) + "</a></p></div>"; }).join("") : '<p class="meta mt-16">К этой главе нет отдельных пометок.</p>') + '<p class="seam">' + esc(chapter.seam || SITE.seams.book) + "</p></aside></div>" +
      seamBlock(SITE.seams.book);

    document.title = "Глава " + chapter.n + ". " + chapter.title + " / Соляной протокол";

    var size = 19;
    try {
      var stored = Number(window.localStorage.getItem("sol-reader-size"));
      if (stored >= 17 && stored <= 23) size = stored;
    } catch (error) { /* без хранилища */ }
    function setSize(value) {
      size = Math.max(17, Math.min(23, value));
      var reader = document.getElementById("reader-text");
      if (reader) reader.style.fontSize = size + "px";
      try { window.localStorage.setItem("sol-reader-size", String(size)); } catch (error) { /* без хранилища */ }
    }
    setSize(size);
    main.querySelectorAll("[data-font]").forEach(function (button) {
      button.addEventListener("click", function () { setSize(size + Number(button.dataset.font)); });
    });
    var printButton = main.querySelector("[data-print]");
    if (printButton) printButton.addEventListener("click", function () { window.print(); });

    var bar = document.getElementById("reader-progress-bar");
    var progressLabel = document.getElementById("reader-progress-label");
    function progress() {
      if (!bar) return;
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var value = height > 0 ? Math.min(100, (window.scrollY / height) * 100) : 0;
      bar.style.width = value + "%";
      if (progressLabel) progressLabel.textContent = Math.round(value) + "%";
    }
    progress();
    window.addEventListener("scroll", progress, { passive: true });
  }

  /* Мир */

  function renderWorld() {
    var cats = [
      { label: "Персонажи", href: "characters.html", count: SITE.characters.length, num: "01", note: "досье и портреты" },
      { label: "Локации", href: "locations.html", count: SITE.locations.length, num: "02", note: "ярусы, дно, слой" },
      { label: "Организации", href: "corporations.html", count: SITE.corporations.length, num: "03", note: "корпорации и коллективы" },
      { label: "Имплантаты", href: "implants.html", count: SITE.implants.length, num: "04", note: "нейро, оптика, тело" },
      { label: "Вооружение", href: "weapons.html", count: SITE.weapons.length, num: "05", note: "служебное и кустарное" }
    ];
    var featured = ["upper-tier", "wet-quarter", "station-zero"].map(findLocation).filter(Boolean);
    var crossList = ["upper-tier", "wet-quarter", "station-zero", "glass-dam", "weave"].map(function (id) {
      var location = findLocation(id);
      if (!location) return "";
      return '<a href="' + U.dossierUrl(id) + '"><span>' + esc(location.name) + '</span><span class="meta">' + esc(location.tier) + "</span></a>";
    }).join("");

    main.innerHTML = pageHead("Мир / Кассий", "Разрез города", "Кассий стоит на дамбе и соляных полях. Верхний ярус дышит отдельно, нижний платит за фильтры, а между ними лежит слой, который город называет порядком.", ["5 ярусов", "10 локаций", "7 организаций"]) +
      '<section class="section--tight"><div class="wrap"><div class="cross-section">' +
        '<svg viewBox="0 0 1200 560" role="img" aria-label="Схематический разрез Кассия: море, дамба, верхний ярус, мокрый квартал, станция Ноль и слой Полотна">' +
          '<defs>' +
            '<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8 8 0" stroke="rgba(79,232,255,.08)" stroke-width="1"/></pattern>' +
            '<pattern id="windows" width="18" height="20" patternUnits="userSpaceOnUse"><rect x="3" y="4" width="4" height="3" fill="rgba(79,232,255,.38)"/><rect x="11" y="13" width="3" height="2" fill="rgba(255,61,154,.42)"/></pattern>' +
            '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081b2a"/><stop offset="1" stop-color="#02040a"/></linearGradient>' +
            '<linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#07131f"/><stop offset=".55" stop-color="#040810"/><stop offset="1" stop-color="#130716"/></linearGradient>' +
          '</defs>' +
          '<rect width="1200" height="560" fill="url(#sky)"/>' +
          '<rect y="300" width="1200" height="260" fill="url(#sea)"/>' +
          '<path d="M0 300H1200" stroke="rgba(79,232,255,.42)" stroke-width="1"/>' +
          '<path d="M0 520 H1200" stroke="rgba(79,232,255,.1)"/>' +
          '<path d="M120 300 L132 145 L168 145 L182 300" fill="#07131f" stroke="rgba(255,61,154,.72)"/>' +
          '<path d="M126 300 L136 150 L164 150 L176 300" fill="none" stroke="rgba(79,232,255,.28)"/>' +
          '<path d="M132 145 L150 120 L168 145" fill="none" stroke="rgba(255,61,154,.72)"/>' +
          '<rect x="220" y="120" width="70" height="180" fill="#08131f" stroke="rgba(79,232,255,.24)"/><rect x="300" y="80" width="54" height="220" fill="#08131f" stroke="rgba(79,232,255,.24)"/><rect x="366" y="150" width="86" height="150" fill="#08131f" stroke="rgba(79,232,255,.24)"/>' +
          '<rect x="470" y="190" width="64" height="110" fill="#08131f" stroke="rgba(79,232,255,.2)"/><rect x="548" y="230" width="70" height="70" fill="#08131f" stroke="rgba(79,232,255,.2)"/>' +
          '<rect x="640" y="225" width="42" height="75" fill="#08131f" stroke="rgba(79,232,255,.18)"/><rect x="696" y="210" width="52" height="90" fill="#08131f" stroke="rgba(79,232,255,.18)"/><rect x="762" y="238" width="36" height="62" fill="#08131f" stroke="rgba(79,232,255,.18)"/><rect x="812" y="252" width="46" height="48" fill="#08131f" stroke="rgba(79,232,255,.18)"/>' +
          '<g fill="url(#windows)" opacity=".9"><rect x="220" y="120" width="70" height="180"/><rect x="300" y="80" width="54" height="220"/><rect x="366" y="150" width="86" height="150"/><rect x="470" y="190" width="64" height="110"/><rect x="548" y="230" width="70" height="70"/><rect x="640" y="225" width="42" height="75"/><rect x="696" y="210" width="52" height="90"/><rect x="762" y="238" width="36" height="62"/><rect x="812" y="252" width="46" height="48"/></g>' +
          '<path d="M200 300 H1040" stroke="rgba(79,232,255,.3)"/><path d="M200 300 V520 H1040 V300" fill="none" stroke="rgba(79,232,255,.18)"/>' +
          '<path d="M260 380 H980 M260 450 H980" stroke="rgba(79,232,255,.12)"/>' +
          '<rect x="260" y="380" width="720" height="140" fill="url(#hatch)" opacity=".72"/>' +
          '<rect x="300" y="400" width="640" height="18" fill="rgba(255,61,154,.06)"/>' +
          '<path d="M0 54 H1200" class="cs-dash"/><text x="24" y="44" class="cs-label cs-label--amber">ПОЛОТНО / СЛОЙ 2</text>' +
          '<path d="M150 145 H70 V110 H24" class="cs-line"/><a href="dossier.html?id=upper-tier"><text x="24" y="106" class="cs-label">ВЕРХНИЙ ЯРУС</text></a>' +
          '<path d="M560 250 H1040 V270" class="cs-line"/><a href="dossier.html?id=wet-quarter"><text x="1046" y="274" class="cs-label">МОКРЫЙ КВАРТАЛ</text></a>' +
          '<path d="M760 430 H1040 V470" class="cs-line"/><a href="dossier.html?id=station-zero"><text x="1046" y="474" class="cs-label">СТАНЦИЯ «НОЛЬ»</text></a>' +
          '<path d="M182 260 H70 V340 H24" class="cs-line"/><a href="dossier.html?id=glass-dam"><text x="24" y="344" class="cs-label">СТЕКЛЯННАЯ ДАМБА</text></a>' +
          '<a href="dossier.html?id=weave"><text x="24" y="520" class="cs-label">ПОЛОТНО / НЕОН</text></a><text x="980" y="520" class="cs-label cs-label--amber">КАРАНТИН Z-9</text>' +
        "</svg></div>" +
        '<div class="cross-list" aria-label="Локации на разрезе города">' + crossList + "</div>" +
        '<p class="meta mt-16">Схема не в масштабе. Пять слоёв: море, дамба, верхний ярус, нижний город и Полотно.</p></div></section>' +
      '<section class="section"><div class="wrap">' + sectionHead("01 / каталоги", "Что описано в архиве") +
        '<div class="world-cats">' + cats.map(function (item) {
          return '<a class="world-cat" href="' + item.href + '"><span class="num">' + item.num + '</span><h3>' + esc(item.label) + '</h3><span class="meta">' + item.count + " " + U.plural(item.count, ["запись", "записи", "записей"]) + " / " + esc(item.note) + "</span></a>";
        }).join("") + "</div></div></section>" +
      '<section class="section"><div class="wrap">' + sectionHead("02 / места", "Три входа") +
        '<div class="card-grid card-grid--3">' + featured.map(locationCard).join("") + "</div></div></section>" +
      '<section class="section"><div class="wrap">' + sectionHead("03 / словарь", "Соляные термины") +
        '<div class="glossary">' + SITE.glossary.map(function (item, i) {
          var found = findEntity(item.link);
          return '<article class="glossary-item" id="term-' + (i + 1) + '"><span class="meta">' + pad(i + 1) + '</span><div><h3>' + esc(item.term) + '</h3><p>' + esc(item.text) + "</p>" + (found ? '<a class="link-quiet" href="' + U.dossierUrl(item.link) + '">' + esc(found.item.name) + "</a>" : "") + "</div></article>";
        }).join("") + "</div></div></section>" +
      seamBlock(SITE.seams.world);

    document.title = "Мир Кассия / Соляной протокол";
  }

  /* Персонажи */

  function renderCharacters() {
    var groups = [
      { id: "all", label: "Все" },
      { id: "main", label: "Основные" },
      { id: "secondary", label: "Второстепенные" },
      { id: "outside", label: "Вне системы" }
    ];
    var state = { group: "all", query: "", view: "grid", sort: "name" };
    var counts = { all: SITE.characters.length, main: 0, secondary: 0, outside: 0 };
    SITE.characters.forEach(function (item) { counts[item.group] += 1; });

    main.innerHTML = pageHead("Мир / персонажи", "Досье", "Десять человек, которые знают слишком много. Часть лиц открыта, часть не фиксируется.", ["10 досье", "7 открытых портретов", "демонстрационные лица"]) +
      '<div class="toolbar"><div class="wrap"><div class="toolbar-row"><div class="tabs" role="tablist" aria-label="Группы персонажей">' + groups.map(function (group) {
        return '<button class="tab" type="button" role="tab" data-group="' + group.id + '" aria-selected="' + (group.id === "all" ? "true" : "false") + '">' + esc(group.label) + '<span class="count">' + counts[group.id] + "</span></button>";
      }).join("") + '</div><div class="toolbar-spacer"></div><div class="tool-field"><label for="char-query">Поиск</label><input id="char-query" type="search" placeholder="имя, роль" autocomplete="off"></div><div class="tool-field"><label for="char-sort">Сортировка</label><select id="char-sort"><option value="name">по имени</option><option value="role">по роли</option><option value="chapter">по главе</option></select></div><div class="view-toggle" role="group" aria-label="Вид каталога"><button type="button" data-view="grid" aria-pressed="true">Сетка</button><button type="button" data-view="list" aria-pressed="false">Список</button></div></div></div></div>' +
      '<section class="section--tight"><div class="wrap"><div class="result-line"><p class="meta" id="char-count"></p><p class="meta">портреты: демонстрационные</p></div><div id="char-results"></div></div></section>' +
      seamBlock(SITE.seams.characters);

    var results = document.getElementById("char-results");
    var count = document.getElementById("char-count");
    var query = document.getElementById("char-query");
    var sort = document.getElementById("char-sort");

    function filtered() {
      var q = norm(state.query);
      return SITE.characters.filter(function (item) {
        if (state.group !== "all" && item.group !== state.group) return false;
        if (!q) return true;
        return norm([item.name, item.role, item.faction, item.aliases, (item.tags || []).join(" ")].join(" ")).indexOf(q) !== -1;
      }).sort(function (a, b) {
        if (state.sort === "role") return a.role.localeCompare(b.role, "ru");
        if (state.sort === "chapter") return a.firstChapter - b.firstChapter;
        return byName(a, b);
      });
    }

    function apply() {
      var list = filtered();
      count.textContent = list.length + " " + U.plural(list.length, ["досье", "досье", "досье"]);
      if (!list.length) {
        results.innerHTML = '<div class="empty"><h3>Никого не нашли</h3><p>В этом фильтре нет персонажей. Сбросьте запрос или выберите другую группу.</p><div class="actions"><button class="link-arrow" type="button" data-reset>Сбросить</button></div></div>';
        var reset = results.querySelector("[data-reset]");
        if (reset) reset.addEventListener("click", function () { state.group = "all"; state.query = ""; query.value = ""; updateTabs(); apply(); });
        return;
      }
      results.innerHTML = state.view === "grid"
        ? '<div class="card-grid">' + list.map(characterCard).join("") + "</div>"
        : '<div class="index-list">' + list.map(characterRow).join("") + "</div>";
    }

    function updateTabs() {
      main.querySelectorAll("[data-group]").forEach(function (button) {
        button.setAttribute("aria-selected", button.dataset.group === state.group ? "true" : "false");
      });
    }

    main.querySelectorAll("[data-group]").forEach(function (button) {
      button.addEventListener("click", function () { state.group = button.dataset.group; updateTabs(); apply(); });
    });
    main.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.view = button.dataset.view;
        main.querySelectorAll("[data-view]").forEach(function (item) { item.setAttribute("aria-pressed", item === button ? "true" : "false"); });
        apply();
      });
    });
    query.addEventListener("input", function () { state.query = query.value; apply(); });
    sort.addEventListener("change", function () { state.sort = sort.value; apply(); });
    apply();
    document.title = "Персонажи / Соляной протокол";
  }

  /* Локации */

  function renderLocations() {
    var groups = [{ id: "all", label: "Все" }, { id: "tier", label: "Ярусы" }, { id: "bottom", label: "Дно" }, { id: "layer", label: "Слой" }];
    var state = { group: "all", query: "", control: "all", access: "all", sort: "tier" };
    var controls = unique(SITE.locations.map(function (item) { return item.control; }));
    var access = unique(SITE.locations.map(function (item) { return item.access; }));
    var counts = { all: SITE.locations.length, tier: 0, bottom: 0, layer: 0 };
    SITE.locations.forEach(function (item) { counts[item.group] += 1; });

    main.innerHTML = pageHead("Мир / локации", "Места", "Кассий делится на ярусы, дно и слой. В каждом месте своя вода, свой допуск и своя версия того, что здесь произошло.", ["10 локаций", "3 группы", "фильтры по контролю"]) +
      '<div class="toolbar"><div class="wrap"><div class="toolbar-row"><div class="tabs" role="tablist" aria-label="Группы локаций">' + groups.map(function (group) {
        return '<button class="tab" type="button" role="tab" data-group="' + group.id + '" aria-selected="' + (group.id === "all" ? "true" : "false") + '">' + esc(group.label) + '<span class="count">' + counts[group.id] + "</span></button>";
      }).join("") + '</div><div class="toolbar-spacer"></div><div class="tool-field"><label for="loc-query">Поиск</label><input id="loc-query" type="search" placeholder="место, контроль" autocomplete="off"></div><div class="tool-field"><label for="loc-sort">Сортировка</label><select id="loc-sort"><option value="tier">по типу</option><option value="name">по имени</option><option value="chapter">по главе</option></select></div><button class="filter-toggle" type="button" data-filter-toggle aria-expanded="true"><span class="dot"></span>Фильтры</button></div>' +
      '<div class="filter-panel" data-open="true" data-filter-panel><div class="filter-group"><p class="meta">Контроль</p><div class="chips"><button class="chip" type="button" data-filter="control" data-value="all" aria-pressed="true">все</button>' + controls.map(function (value) { return '<button class="chip" type="button" data-filter="control" data-value="' + esc(value) + '" aria-pressed="false">' + esc(value) + "</button>"; }).join("") + '</div></div><div class="filter-group"><p class="meta">Доступ</p><div class="chips"><button class="chip" type="button" data-filter="access" data-value="all" aria-pressed="true">все</button>' + access.map(function (value) { return '<button class="chip" type="button" data-filter="access" data-value="' + esc(value) + '" aria-pressed="false">' + esc(value) + "</button>"; }).join("") + '</div></div><div class="filter-actions"><button type="button" data-reset>Сбросить</button></div></div></div></div>' +
      '<section class="section--tight"><div class="wrap"><div class="result-line"><p class="meta" id="loc-count"></p><p class="meta">фильтры сохраняются в адресе</p></div><div id="loc-results"></div></div></section>' +
      seamBlock(SITE.seams.locations);

    var results = document.getElementById("loc-results");
    var count = document.getElementById("loc-count");
    var query = document.getElementById("loc-query");
    var sort = document.getElementById("loc-sort");
    var panel = main.querySelector("[data-filter-panel]");

    function filtered() {
      var q = norm(state.query);
      return SITE.locations.filter(function (item) {
        if (state.group !== "all" && item.group !== state.group) return false;
        if (state.control !== "all" && item.control !== state.control) return false;
        if (state.access !== "all" && item.access !== state.access) return false;
        if (!q) return true;
        return norm([item.name, item.summary, item.control, item.access, item.tier].join(" ")).indexOf(q) !== -1;
      }).sort(function (a, b) {
        if (state.sort === "name") return byName(a, b);
        if (state.sort === "chapter") return a.firstChapter - b.firstChapter;
        return a.group.localeCompare(b.group, "ru");
      });
    }

    function apply() {
      var list = filtered();
      count.textContent = list.length + " " + U.plural(list.length, ["место", "места", "мест"]);
      if (!list.length) {
        results.innerHTML = '<div class="empty"><h3>Пусто</h3><p>В этом сочетании фильтров нет локаций. Сбросьте фильтры и попробуйте снова.</p><div class="actions"><button class="link-arrow" type="button" data-reset>Сбросить</button></div></div>';
        var reset = results.querySelector("[data-reset]");
        if (reset) reset.addEventListener("click", resetAll);
        return;
      }
      results.innerHTML = '<div class="card-grid card-grid--3">' + list.map(locationCard).join("") + "</div>";
    }

    function updateTabs() {
      main.querySelectorAll("[data-group]").forEach(function (button) { button.setAttribute("aria-selected", button.dataset.group === state.group ? "true" : "false"); });
    }

    function updateChips() {
      main.querySelectorAll("[data-filter]").forEach(function (button) {
        var key = button.dataset.filter;
        button.setAttribute("aria-pressed", state[key] === button.dataset.value ? "true" : "false");
      });
    }

    function resetAll() {
      state.group = "all"; state.query = ""; state.control = "all"; state.access = "all";
      query.value = ""; updateTabs(); updateChips(); apply();
    }

    main.querySelectorAll("[data-group]").forEach(function (button) {
      button.addEventListener("click", function () { state.group = button.dataset.group; updateTabs(); apply(); });
    });
    main.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () {
        state[button.dataset.filter] = button.dataset.value;
        updateChips(); apply();
      });
    });
    query.addEventListener("input", function () { state.query = query.value; apply(); });
    sort.addEventListener("change", function () { state.sort = sort.value; apply(); });
    var toggle = main.querySelector("[data-filter-toggle]");
    if (toggle) toggle.addEventListener("click", function () {
      var open = panel.dataset.open !== "true";
      panel.dataset.open = open ? "true" : "false";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var resetButton = main.querySelector(".filter-actions [data-reset]");
    if (resetButton) resetButton.addEventListener("click", resetAll);
    apply();
    document.title = "Локации / Соляной протокол";
  }

  function unique(values) {
    return values.filter(function (value, i) { return values.indexOf(value) === i; });
  }

  /* Организации */

  function renderCorporations() {
    var groups = [{ id: "all", label: "Все" }, { id: "corp", label: "Корпорации" }, { id: "power", label: "Власть" }, { id: "collective", label: "Коллективы" }];
    var state = { group: "all", query: "", sort: "name" };
    var counts = { all: SITE.corporations.length, corp: 0, power: 0, collective: 0 };
    SITE.corporations.forEach(function (item) { counts[item.group] += 1; });

    main.innerHTML = pageHead("Мир / организации", "Кто держит Кассий", "Четыре корпорации, городской комитет и два коллектива, которые не считают себя властью, но без которых город не работает.", ["7 организаций", "4 корпорации", "2 коллектива"]) +
      '<div class="toolbar"><div class="wrap"><div class="toolbar-row"><div class="tabs" role="tablist" aria-label="Группы организаций">' + groups.map(function (group) {
        return '<button class="tab" type="button" role="tab" data-group="' + group.id + '" aria-selected="' + (group.id === "all" ? "true" : "false") + '">' + esc(group.label) + '<span class="count">' + counts[group.id] + "</span></button>";
      }).join("") + '</div><div class="toolbar-spacer"></div><div class="tool-field"><label for="corp-query">Поиск</label><input id="corp-query" type="search" placeholder="название, сфера" autocomplete="off"></div><div class="tool-field"><label for="corp-sort">Сортировка</label><select id="corp-sort"><option value="name">по имени</option><option value="founded">по году</option><option value="sector">по сфере</option></select></div></div></div></div>' +
      '<section class="section--tight"><div class="wrap"><div class="result-line"><p class="meta" id="corp-count"></p><p class="meta">уставы и договоры</p></div><div id="corp-results"></div></div></section>' +
      seamBlock(SITE.seams.corporations);

    var results = document.getElementById("corp-results");
    var count = document.getElementById("corp-count");
    var query = document.getElementById("corp-query");
    var sort = document.getElementById("corp-sort");

    function filtered() {
      var q = norm(state.query);
      return SITE.corporations.filter(function (item) {
        if (state.group !== "all" && item.group !== state.group) return false;
        if (!q) return true;
        return norm([item.name, item.sector, item.summary, item.motto, item.holdings].join(" ")).indexOf(q) !== -1;
      }).sort(function (a, b) {
        if (state.sort === "founded") return a.founded.localeCompare(b.founded);
        if (state.sort === "sector") return a.sector.localeCompare(b.sector, "ru");
        return byName(a, b);
      });
    }

    function apply() {
      var list = filtered();
      count.textContent = list.length + " " + U.plural(list.length, ["организация", "организации", "организаций"]);
      if (!list.length) {
        results.innerHTML = '<div class="empty"><h3>Ничего не найдено</h3><p>Попробуйте другое название или сбросьте фильтр.</p></div>';
        return;
      }
      results.innerHTML = '<div class="org-grid">' + list.map(orgCard).join("") + "</div>";
    }

    main.querySelectorAll("[data-group]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.group = button.dataset.group;
        main.querySelectorAll("[data-group]").forEach(function (item) { item.setAttribute("aria-selected", item === button ? "true" : "false"); });
        apply();
      });
    });
    query.addEventListener("input", function () { state.query = query.value; apply(); });
    sort.addEventListener("change", function () { state.sort = sort.value; apply(); });
    apply();
    document.title = "Организации / Соляной протокол";
  }

  /* Каталоги: имплантаты и вооружение */

  function renderCatalogue(kind) {
    var isImplant = kind === "implant";
    var items = isImplant ? SITE.implants : SITE.weapons;
    var groups = isImplant
      ? [{ id: "all", label: "Все" }, { id: "neuro", label: "Нейро" }, { id: "optic", label: "Оптика" }, { id: "body", label: "Тело" }, { id: "medical", label: "Медицина" }]
      : [{ id: "all", label: "Все" }, { id: "pistol", label: "Пистолеты" }, { id: "heavy", label: "Тяжёлое" }, { id: "nonlethal", label: "Нелетальное" }, { id: "handmade", label: "Кустарное" }];
    var legalities = unique(items.map(function (item) { return item.legality; }));
    var state = { group: "all", query: "", legality: "all", sort: "name", dir: 1 };
    var counts = { all: items.length };
    items.forEach(function (item) { counts[item.group] = (counts[item.group] || 0) + 1; });
    var title = isImplant ? "Имплантаты" : "Вооружение";
    var eyebrow = isImplant ? "Мир / имплантаты" : "Мир / вооружение";
    var lead = isImplant
      ? "Восемь устройств, которые город ставит в тело. От разрешённого гнезда до зеркала, которого нет в лицензии."
      : "Семь единиц, которые город носит на ремне или в кармане. Служебные, кустарные и те, что не должны существовать.";

    main.innerHTML = pageHead(eyebrow, title, lead, [items.length + " записей", "фильтры по статусу", "сортировка по столбцам"]) +
      '<div class="toolbar"><div class="wrap"><div class="toolbar-row"><div class="tabs" role="tablist" aria-label="Классы">' + groups.map(function (group) {
        var n = group.id === "all" ? items.length : (counts[group.id] || 0);
        return '<button class="tab" type="button" role="tab" data-group="' + group.id + '" aria-selected="' + (group.id === "all" ? "true" : "false") + '">' + esc(group.label) + '<span class="count">' + n + "</span></button>";
      }).join("") + '</div><div class="toolbar-spacer"></div><div class="tool-field"><label for="cat-query">Поиск</label><input id="cat-query" type="search" placeholder="название, производитель" autocomplete="off"></div><button class="filter-toggle" type="button" data-filter-toggle aria-expanded="true"><span class="dot"></span>Фильтры</button></div>' +
      '<div class="filter-panel" data-open="true" data-filter-panel><div class="filter-group"><p class="meta">Правовой статус</p><div class="chips"><button class="chip" type="button" data-filter="legality" data-value="all" aria-pressed="true">все</button>' + legalities.map(function (value) { return '<button class="chip" type="button" data-filter="legality" data-value="' + esc(value) + '" aria-pressed="false">' + esc(value) + "</button>"; }).join("") + '</div></div><div class="filter-actions"><button type="button" data-reset>Сбросить</button></div></div></div></div>' +
      '<section class="section--tight"><div class="wrap"><div class="result-line"><p class="meta" id="cat-count"></p><p class="meta">нажмите на заголовок столбца для сортировки</p></div><div id="cat-results"></div></div></section>' +
      seamBlock(isImplant ? SITE.seams.implants : SITE.seams.weapons);

    var results = document.getElementById("cat-results");
    var count = document.getElementById("cat-count");
    var query = document.getElementById("cat-query");
    var panel = main.querySelector("[data-filter-panel]");

    function filtered() {
      var q = norm(state.query);
      return items.filter(function (item) {
        if (state.group !== "all" && item.group !== state.group) return false;
        if (state.legality !== "all" && item.legality !== state.legality) return false;
        if (!q) return true;
        return norm([item.name, item.cls, item.maker, item.summary, item.bio, item.legality].join(" ")).indexOf(q) !== -1;
      }).sort(function (a, b) {
        var left = a[state.sort];
        var right = b[state.sort];
        if (Array.isArray(left)) left = left.join(",");
        if (Array.isArray(right)) right = right.join(",");
        return String(left).localeCompare(String(right), "ru") * state.dir;
      });
    }

    function sortButton(key, label) {
      var active = state.sort === key;
      return '<button type="button" data-sort="' + key + '"' + (active ? ' data-sort-active="true"' : "") + ">" + esc(label) + (active ? (state.dir === 1 ? " ↑" : " ↓") : "") + "</button>";
    }

    function table(list) {
      var columns = isImplant
        ? [["name", "Название"], ["cls", "Класс"], ["maker", "Производитель"], ["legality", "Статус"], ["risk", "Риск"], ["chapters", "Главы"]]
        : [["name", "Название"], ["cls", "Класс"], ["maker", "Производитель"], ["legality", "Статус"], ["ammo", "Боеприпас"], ["chapters", "Главы"]];
      return '<div class="table-wrap"><table class="data"><thead><tr>' + columns.map(function (column) {
        return "<th>" + sortButton(column[0], column[1]) + "</th>";
      }).join("") + "</tr></thead><tbody>" + list.map(function (item) {
        return '<tr><td class="name"><a href="' + U.dossierUrl(item.id) + '">' + esc(item.name) + "</a></td><td><span class=\"mono\">" + esc(item.cls) + '</span></td><td><span class="mono">' + esc(item.maker) + '</span></td><td>' + badge(item.legality) + '</td><td><span class="mono">' + esc(isImplant ? item.risk : item.ammo) + '</span></td><td><span class="mono">' + item.chapters.map(function (n) { return '<a class="link-quiet" href="' + U.chapterUrl(n) + '">' + n + "</a>"; }).join(", ") + "</span></td></tr>";
      }).join("") + "</tbody></table></div>";
    }

    function apply() {
      var list = filtered();
      count.textContent = list.length + " " + U.plural(list.length, ["запись", "записи", "записей"]);
      if (!list.length) {
        results.innerHTML = '<div class="empty"><h3>Пусто</h3><p>В этом фильтре нет записей. Сбросьте статус или поиск.</p><div class="actions"><button class="link-arrow" type="button" data-reset>Сбросить</button></div></div>';
        var reset = results.querySelector("[data-reset]");
        if (reset) reset.addEventListener("click", resetAll);
        return;
      }
      results.innerHTML = table(list);
    }

    function updateChips() {
      main.querySelectorAll("[data-filter]").forEach(function (button) {
        button.setAttribute("aria-pressed", state[button.dataset.filter] === button.dataset.value ? "true" : "false");
      });
    }

    function resetAll() {
      state.group = "all"; state.query = ""; state.legality = "all"; state.sort = "name"; state.dir = 1;
      query.value = "";
      main.querySelectorAll("[data-group]").forEach(function (button) { button.setAttribute("aria-selected", button.dataset.group === "all" ? "true" : "false"); });
      updateChips(); apply();
    }

    main.querySelectorAll("[data-group]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.group = button.dataset.group;
        main.querySelectorAll("[data-group]").forEach(function (item) { item.setAttribute("aria-selected", item === button ? "true" : "false"); });
        apply();
      });
    });
    main.querySelectorAll("[data-filter]").forEach(function (button) {
      button.addEventListener("click", function () { state.legality = button.dataset.value; updateChips(); apply(); });
    });
    query.addEventListener("input", function () { state.query = query.value; apply(); });
    results.addEventListener("click", function (event) {
      var button = event.target.closest("[data-sort]");
      if (!button) return;
      var key = button.dataset.sort;
      if (state.sort === key) state.dir *= -1;
      else { state.sort = key; state.dir = 1; }
      apply();
    });
    var toggle = main.querySelector("[data-filter-toggle]");
    if (toggle) toggle.addEventListener("click", function () {
      var open = panel.dataset.open !== "true";
      panel.dataset.open = open ? "true" : "false";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var resetButton = main.querySelector(".filter-actions [data-reset]");
    if (resetButton) resetButton.addEventListener("click", resetAll);
    apply();
    document.title = title + " / Соляной протокол";
  }

  /* Галерея */

  function renderGallery() {
    var groups = [{ id: "all", label: "Все" }, { id: "Персонажи", label: "Персонажи" }, { id: "Локации", label: "Локации" }, { id: "Техника", label: "Техника" }, { id: "Обложки", label: "Обложки" }];
    var state = { group: "all", sort: "chapter" };
    var counts = { all: SITE.gallery.length };
    SITE.gallery.forEach(function (item) { counts[item.type] = (counts[item.type] || 0) + 1; });

    main.innerHTML = pageHead("Архив / пластины", "Галерея", "Контактный лист Кассия: улицы, ярусы, лица и обложки. Все фотографии тонированы и приведены к локальным размерам.", [SITE.gallery.length + " пластин", "5 разделов", "свободные лицензии"]) +
      '<div class="toolbar"><div class="wrap"><div class="toolbar-row"><div class="tabs" role="tablist" aria-label="Разделы галереи">' + groups.map(function (group) {
        var n = group.id === "all" ? SITE.gallery.length : (counts[group.id] || 0);
        return '<button class="tab" type="button" role="tab" data-group="' + group.id + '" aria-selected="' + (group.id === "all" ? "true" : "false") + '">' + esc(group.label) + '<span class="count">' + n + "</span></button>";
      }).join("") + '</div><div class="toolbar-spacer"></div><div class="tool-field"><label for="gal-sort">Сортировка</label><select id="gal-sort"><option value="chapter">по главе</option><option value="title">по названию</option><option value="type">по разделу</option></select></div></div></div></div>' +
      '<section class="section--tight"><div class="wrap"><div class="result-line"><p class="meta" id="gal-count"></p><p class="meta">клик открывает пластину</p></div><div class="gallery-grid" id="gal-results"></div></div></section>' +
      seamBlock(SITE.seams.gallery);

    var results = document.getElementById("gal-results");
    var count = document.getElementById("gal-count");
    var sort = document.getElementById("gal-sort");
    var current = [];

    function filtered() {
      return SITE.gallery.filter(function (item) { return state.group === "all" || item.type === state.group; }).sort(function (a, b) {
        if (state.sort === "title") return a.title.localeCompare(b.title, "ru");
        if (state.sort === "type") return a.type.localeCompare(b.type, "ru");
        return a.chapter - b.chapter;
      });
    }

    function apply() {
      current = filtered();
      count.textContent = current.length + " " + U.plural(current.length, ["пластина", "пластины", "пластин"]);
      results.innerHTML = current.map(function (item) { return galleryFigure(item); }).join("");
    }

    main.querySelectorAll("[data-group]").forEach(function (button) {
      button.addEventListener("click", function () {
        state.group = button.dataset.group;
        main.querySelectorAll("[data-group]").forEach(function (item) { item.setAttribute("aria-selected", item === button ? "true" : "false"); });
        apply();
      });
    });
    sort.addEventListener("change", function () { state.sort = sort.value; apply(); });
    apply();
    initLightbox(function () { return current; });
    document.title = "Галерея / Соляной протокол";
  }

  function initLightbox(getCurrent) {
    var dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.id = "lightbox";
    dialog.setAttribute("aria-label", "Просмотр пластины");
    dialog.innerHTML = '<div class="dialog-head"><span class="dialog-title">Пластина</span><button class="dialog-close" type="button" data-close-lightbox aria-label="Закрыть просмотр">×</button></div><div class="dialog-body"><div class="lb-stage" id="lb-stage"></div><div class="lb-info"><div><h3 id="lb-title"></h3><p class="meta" id="lb-meta"></p><p class="meta" id="lb-credit"></p></div><div class="lb-nav"><span class="lb-count" id="lb-count"></span><button type="button" data-lb-prev aria-label="Предыдущая пластина">←</button><button type="button" data-lb-next aria-label="Следующая пластина">→</button></div></div></div>';
    document.body.appendChild(dialog);
    var stage = dialog.querySelector("#lb-stage");
    var title = dialog.querySelector("#lb-title");
    var meta = dialog.querySelector("#lb-meta");
    var credit = dialog.querySelector("#lb-credit");
    var counter = dialog.querySelector("#lb-count");
    var currentList = [];
    var index = 0;

    function open(id) {
      currentList = typeof getCurrent === "function" ? getCurrent() : currentList;
      index = currentList.findIndex(function (item) { return item.id === id; });
      if (index < 0) index = 0;
      render();
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      try { history.replaceState(null, "", "#" + id); } catch (error) { location.hash = id; }
    }

    function close() {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      try { history.replaceState(null, "", location.pathname + location.search); } catch (error) { /* file:// */ }
    }

    function render() {
      var item = currentList[index];
      if (!item) return;
      if (item.cover) {
        stage.innerHTML = U.cover(item.cover, { large: true });
      } else {
        stage.innerHTML = U.img(item.img, { alt: item.title, focus: item.focus, sizes: "90vw", loading: "eager" });
      }
      title.textContent = item.title;
      meta.textContent = [item.type, item.note, item.chapter ? "глава " + item.chapter : ""].filter(Boolean).join(" / ");
      if (item.cover) {
        credit.textContent = "Типографическая обложка. Демонстрационный материал.";
      } else {
        var image = SITE.images[item.img];
        credit.innerHTML = image ? "Фото: " + esc(image.artist) + " / " + esc(image.license) + ' / <a class="link-quiet" href="' + esc(image.page) + '" target="_blank" rel="noopener">источник</a>' : "";
      }
      counter.textContent = (index + 1) + " / " + currentList.length;
    }

    function step(delta) {
      index = (index + delta + currentList.length) % currentList.length;
      render();
      try { history.replaceState(null, "", "#" + currentList[index].id); } catch (error) { /* file:// */ }
    }

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close();
    });
    dialog.querySelector("[data-close-lightbox]").addEventListener("click", close);
    dialog.querySelector("[data-lb-prev]").addEventListener("click", function () { step(-1); });
    dialog.querySelector("[data-lb-next]").addEventListener("click", function () { step(1); });
    document.addEventListener("keydown", function (event) {
      if (!dialog.open) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); }
    });
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-lightbox]");
      if (trigger) open(trigger.dataset.lightbox);
    });
    var hash = location.hash.slice(1);
    if (hash) {
      var found = SITE.gallery.find(function (item) { return item.id === hash; });
      if (found) window.setTimeout(function () { open(hash); }, 120);
    }
  }

  /* Автор и проект */

  function renderAbout() {
    var credits = Object.keys(SITE.images).map(function (slug) {
      var image = SITE.images[slug];
      return '<div class="credit-row"><span class="credit-title">' + esc(imageLabels[slug] || slug) + '</span><span class="meta">' + esc(image.artist) + '</span><span class="meta">' + esc(image.license) + '</span><a class="link-quiet" href="' + esc(image.page) + '" target="_blank" rel="noopener">источник</a></div>';
    }).join("");

    main.innerHTML = pageHead("Архив / автор", "Илья Верес", "Пишет мокрый биотех-детектив и мрачную фантастику. Живёт в городе, где тоже идёт дождь по расписанию.", ["демонстрационный автор", "1 роман", "1 повесть", "1 сборник", "1 артбук"]) +
      '<section class="section"><div class="wrap author-grid"><div class="author-portrait"><span class="author-monogram" aria-hidden="true">ИВ</span><p class="meta mt-8">фотография автора не публикуется</p></div><div class="author-body"><p class="eyebrow">кратко</p><p class="lead mt-16">Илья Верес родился в портовом городе, который позже стал Кассием. Работал грузчиком, техником связи и архивистом. В 2026 году вышли сборник «Мокрый след» и роман «Соляной протокол». Книга писалась как архив: с документами, досье и служебными пометками на полях.</p><p>Верес не любит интервью и не появляется на фотографиях. В архиве нет ни одного его портрета. Это не мистификация, а привычка: он считает, что автор должен быть слышен, а не виден.</p><p class="quote">Я пишу не о будущем. Я пишу о настоящем, у которого отключили рекламу.</p><div class="note-sign">Илья Верес / Кассий</div></div></div></section>' +
      '<section class="section" id="project"><div class="wrap"><div class="section-head"><span class="num">01 / проект</span><h2>Как устроен архив</h2></div><div class="note"><div><p class="meta">офлайн</p><p class="meta">без сервера</p><p class="meta">без сбора данных</p></div><div class="note-body"><p>Это демонстрационный артбук-архив, а не магазин и не промо-страница. Здесь нет цен, покупок, подписок, отзывов и счётчиков. Сайт открывается с диска, не требует установки и не делает внешних запросов.</p><p>Шрифты Cormorant, Literata и IBM Plex Mono лежат в файлах страницы. Поиск работает на локальном Fuse.js. Все изображения приведены к локальным размерам и тонированы. Ссылки на источники открываются только по нажатию.</p><p>Книга, автор, город и персонажи вымышлены. Совпадения с реальными людьми и организациями случайны. Фотографии взяты по свободным лицензиям, авторы указаны ниже.</p></div></div></div></section>' +
      '<section class="section" id="credits"><div class="wrap"><div class="section-head"><span class="num">02 / кредиты</span><h2>Изображения и лицензии</h2></div><div class="credit-list">' + credits + '</div><p class="meta mt-24">Фотографии тонированы и кадрированы для демонстрационного макета. Оригиналы доступны по ссылкам «источник».</p></div></section>' +
      '<section class="section"><div class="wrap"><div class="section-head"><span class="num">03 / техника</span><h2>Что внутри</h2></div><div class="card-grid card-grid--3"><div class="info-card"><h3>Шрифты</h3><p class="meta meta--plain">Cormorant, Literata, IBM Plex Mono. SIL Open Font License, файл assets/fonts/OFL.txt.</p></div><div class="info-card"><h3>Поиск</h3><p class="meta meta--plain">Fuse.js 7.5.0, MIT. Индекс собирается на клиенте из локального файла данных.</p></div><div class="info-card"><h3>Сборка</h3><p class="meta meta--plain">HTML, CSS и классический JavaScript. Без сборщика, без модулей, без fetch.</p></div></div></div></section>' +
      seamBlock(SITE.seams.about);

    document.title = "Илья Верес / Соляной протокол";
  }

  /* Досье */

  function renderDossier() {
    var id = U.param("id", "");
    var found = findEntity(id);
    if (!found) {
      notFound("В архиве нет досье с таким идентификатором.");
      return;
    }
    var item = found.item;
    var kind = found.kind;
    var body = "";

    if (kind === "character") {
      body = characterDossier(item);
    } else if (kind === "location") {
      body = locationDossier(item);
    } else if (kind === "corporation") {
      body = corporationDossier(item);
    } else {
      body = thingDossier(item, kind);
    }

    main.innerHTML = body + seamBlock(item.seam);
    document.title = item.name + " / Соляной протокол";
  }

  function dossierHead(title, eyebrow, aliases, visual, meta) {
    return '<header class="dossier-head"><div><p class="eyebrow">' + esc(eyebrow) + "</p><h1>" + esc(title) + "</h1>" +
      (aliases ? '<p class="aliases">' + esc(aliases) + "</p>" : "") +
      (meta ? '<div class="page-head-meta">' + meta.map(function (line) { return '<span class="meta">' + esc(line) + "</span>"; }).join("") + "</div>" : "") +
      "</div><div class=\"dossier-portrait\">" + visual + "</div></header>";
  }

  function characterDossier(item) {
    var visual = item.portrait
      ? U.plate(item.portrait, { alt: item.name, cls: "plate--tall", focus: item.focus, sizes: "(max-width: 900px) 70vw, 360px", loading: "eager" }) + '<p class="meta">' + esc(item.portraitNote || "демонстрационный портрет") + "</p>"
      : '<span class="plate plate--tall portrait-fallback"><span class="pf-mark">' + esc(initials(item.name)) + '</span><span class="pf-label">портрет не открыт</span></span><p class="meta">' + esc(item.portraitNote || "лицо не фиксируется") + "</p>";
    var relations = item.relations.map(function (rel) {
      return '<a class="relation-row" href="' + entityUrl(rel.id) + '"><span class="rel-name">' + esc(entityName(rel.id)) + '</span><span class="rel-role">' + esc(rel.role) + "</span></a>";
    }).join("");
    var implants = item.implants.map(function (implantId) {
      var implant = findImplant(implantId);
      return implant ? '<a class="relation-row" href="' + U.dossierUrl(implant.id) + '"><span class="rel-name">' + esc(implant.name) + '</span><span class="rel-role">' + esc(implant.cls) + "</span></a>" : "";
    }).join("");
    return crumbs([{ label: "Мир", href: "world.html" }, { label: "Персонажи", href: "characters.html" }, { label: item.name, href: "#" }]) +
      dossierHead(item.name, "Досье / персонаж", item.aliases, visual, [item.role, item.faction, item.status, "глава " + item.firstChapter]) +
      '<div class="wrap dossier-body"><div class="dossier-main">' + item.bio.map(function (text) { return "<p>" + esc(text) + "</p>"; }).join("") +
        '<p class="quote">«' + esc(item.quote) + "»</p>" +
        '<div class="sub-actions"><a class="link-arrow" href="chapter.html?n=' + item.firstChapter + '">Первое появление</a><a class="link-arrow" href="characters.html">Все персонажи</a></div></div>' +
      '<aside class="dossier-aside"><table class="id-table"><tr><th>Возраст</th><td>' + esc(item.age) + '</td></tr><tr><th>Фракция</th><td>' + esc(item.faction) + '</td></tr><tr><th>Статус</th><td>' + esc(item.status) + '</td></tr><tr><th>Метки</th><td>' + esc((item.tags || []).join(", ")) + "</td></tr></table>" +
        '<h2 class="aside-title">Связи</h2><div class="relation-list">' + relations + "</div>" +
        (implants ? '<h2 class="aside-title">Имплантаты</h2><div class="relation-list">' + implants + "</div>" : "") +
        '<h2 class="aside-title">Слой 2</h2><p class="seam">' + esc(item.seam) + "</p></aside></div>";
  }

  function locationDossier(item) {
    var visual = U.plate(item.img, { alt: item.name, cls: "plate--wide", focus: item.focus, sizes: "(max-width: 900px) 70vw, 360px", loading: "eager" }) + '<p class="meta">пластина / ' + esc(item.img) + "</p>";
    var relations = item.related.map(function (relId) {
      return '<a class="relation-row" href="' + entityUrl(relId) + '"><span class="rel-name">' + esc(entityName(relId)) + '</span><span class="rel-role">связь</span></a>';
    }).join("");
    return crumbs([{ label: "Мир", href: "world.html" }, { label: "Локации", href: "locations.html" }, { label: item.name, href: "#" }]) +
      dossierHead(item.name, "Досье / локация", item.summary, visual, [item.tier, item.control, item.access, item.status]) +
      '<div class="wrap dossier-body"><div class="dossier-main">' + item.bio.map(function (text) { return "<p>" + esc(text) + "</p>"; }).join("") +
        '<h2>Опасности</h2><p>' + esc(item.hazards) + '</p><div class="sub-actions"><a class="link-arrow" href="locations.html">Все локации</a><a class="link-arrow" href="world.html">Разрез города</a></div></div>' +
      '<aside class="dossier-aside"><table class="id-table"><tr><th>Тип</th><td>' + esc(item.tier) + '</td></tr><tr><th>Контроль</th><td>' + esc(item.control) + '</td></tr><tr><th>Доступ</th><td>' + esc(item.access) + '</td></tr><tr><th>Статус</th><td>' + esc(item.status) + '</td></tr><tr><th>Первая глава</th><td><a class="link" href="' + U.chapterUrl(item.firstChapter) + '">' + item.firstChapter + "</a></td></tr></table>" +
        '<h2 class="aside-title">Связи</h2><div class="relation-list">' + relations + '</div><h2 class="aside-title">Слой 2</h2><p class="seam">' + esc(item.seam) + "</p></aside></div>";
  }

  function corporationDossier(item) {
    var visual = '<span class="org-seal org-seal--large" aria-hidden="true">' + esc(initials(item.name)) + '</span><p class="meta">устав / ' + esc(item.founded) + "</p>";
    var relations = item.related.map(function (relId) {
      return '<a class="relation-row" href="' + entityUrl(relId) + '"><span class="rel-name">' + esc(entityName(relId)) + '</span><span class="rel-role">связь</span></a>';
    }).join("");
    return crumbs([{ label: "Мир", href: "world.html" }, { label: "Организации", href: "corporations.html" }, { label: item.name, href: "#" }]) +
      dossierHead(item.name, "Досье / организация", item.motto, visual, [item.sector, item.status, item.founded]) +
      '<div class="wrap dossier-body"><div class="dossier-main">' + item.bio.map(function (text) { return "<p>" + esc(text) + "</p>"; }).join("") +
        '<p class="quote">«' + esc(item.motto) + "»</p>" + '<div class="sub-actions"><a class="link-arrow" href="corporations.html">Все организации</a></div></div>' +
      '<aside class="dossier-aside"><table class="id-table"><tr><th>Сфера</th><td>' + esc(item.sector) + '</td></tr><tr><th>Статус</th><td>' + esc(item.status) + '</td></tr><tr><th>Основано</th><td>' + esc(item.founded) + '</td></tr><tr><th>Владения</th><td>' + esc(item.holdings) + "</td></tr></table>" +
        '<h2 class="aside-title">Связи</h2><div class="relation-list">' + relations + '</div><h2 class="aside-title">Слой 2</h2><p class="seam">' + esc(item.seam) + "</p></aside></div>";
  }

  function thingDossier(item, kind) {
    var isImplant = kind === "implant";
    var visual = '<span class="dossier-scheme"><span class="ds-mark">' + esc(initials(item.name)) + '</span><span class="ds-label">' + (isImplant ? "схема имплантата" : "схема вооружения") + '</span><span class="ds-code">' + esc(item.id) + "</span></span>";
    var relations = item.related.map(function (relId) {
      return '<a class="relation-row" href="' + entityUrl(relId) + '"><span class="rel-name">' + esc(entityName(relId)) + '</span><span class="rel-role">связь</span></a>';
    }).join("");
    var chapters = item.chapters.map(function (n) { return '<a class="link-quiet" href="' + U.chapterUrl(n) + '">' + n + "</a>"; }).join(", ");
    return crumbs([{ label: "Мир", href: "world.html" }, { label: isImplant ? "Имплантаты" : "Вооружение", href: isImplant ? "implants.html" : "weapons.html" }, { label: item.name, href: "#" }]) +
      dossierHead(item.name, "Досье / " + (isImplant ? "имплантат" : "вооружение"), item.summary, visual, [item.cls, item.maker, item.legality]) +
      '<div class="wrap dossier-body"><div class="dossier-main"><p>' + esc(item.bio) + '</p><p class="quote">' + esc(item.summary) + '</p><div class="sub-actions"><a class="link-arrow" href="' + (isImplant ? "implants.html" : "weapons.html") + '">Весь каталог</a></div></div>' +
      '<aside class="dossier-aside"><table class="id-table"><tr><th>Класс</th><td>' + esc(item.cls) + '</td></tr><tr><th>Производитель</th><td>' + esc(item.maker) + '</td></tr><tr><th>Статус</th><td>' + esc(item.legality) + "</td></tr><tr><th>" + (isImplant ? "Риск" : "Боеприпас") + "</th><td>" + esc(isImplant ? item.risk : item.ammo) + '</td></tr><tr><th>Главы</th><td>' + chapters + "</td></tr></table>" +
        '<h2 class="aside-title">Связи</h2><div class="relation-list">' + relations + '</div><h2 class="aside-title">Слой 2</h2><p class="seam">' + esc(item.seam) + "</p></aside></div>";
  }

  /* Запуск */

  function reveal() {
    var nodes = main.querySelectorAll(".section, .cover, .page-head, .dossier-head, .reader-head");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (node) { node.classList.add("is-in"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    nodes.forEach(function (node) { node.classList.add("reveal"); observer.observe(node); });
  }

  function render() {
    if (!main) return;
    if (page === "home") renderHome();
    else if (page === "library") renderLibrary();
    else if (page === "book") renderBook();
    else if (page === "chapter") renderChapter();
    else if (page === "world") renderWorld();
    else if (page === "characters") renderCharacters();
    else if (page === "locations") renderLocations();
    else if (page === "corporations") renderCorporations();
    else if (page === "implants") renderCatalogue("implant");
    else if (page === "weapons") renderCatalogue("weapon");
    else if (page === "gallery") renderGallery();
    else if (page === "about") renderAbout();
    else if (page === "dossier") renderDossier();
    else notFound();
    reveal();
  }

  render();
})();
