/* Шапка, подвал, поиск, слой 2. Классический скрипт, без модулей. */

(function () {
  "use strict";

  var SITE = window.SITE;
  var doc = document;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function img(slug, options) {
    options = options || {};
    var meta = SITE.images[slug];
    if (!meta) return "";
    var widths = meta.widths;
    var fallback = widths[Math.min(1, widths.length - 1)];
    var srcset = widths.map(function (w) {
      return "assets/art/" + slug + "-" + w + ".webp " + w + "w";
    }).join(", ");
    var height = Math.round(fallback / meta.ratio);
    var sizes = options.sizes || "(max-width: 680px) 100vw, (max-width: 1100px) 50vw, 33vw";
    return '<img src="assets/art/' + slug + "-" + fallback + '.webp" srcset="' + srcset + '" sizes="' + esc(sizes) + '" width="' + fallback + '" height="' + height + '" alt="' + esc(options.alt || "") + '" loading="' + (options.loading || "lazy") + '" decoding="async" style="--focus:' + esc(options.focus || "50% 50%") + '">';
  }

  function plate(slug, options) {
    options = options || {};
    return '<span class="plate ' + (options.cls || "plate--wide") + '">' + img(slug, options) +
      (options.num ? '<span class="plate-num">' + esc(options.num) + "</span>" : "") + "</span>";
  }

  var coverData = {
    sol: { kicker: "роман", title: ["Соляной", "протокол"], author: "Илья Верес", code: "К. / 2026", mark: "С" },
    wet: { kicker: "сборник", title: ["Мокрый", "след"], author: "Илья Верес", code: "записи / 2026", mark: "М" },
    zero: { kicker: "повесть", title: ["Станция", "«Ноль»"], author: "Илья Верес", code: "в работе / 2027", mark: "0" },
    salt: { kicker: "артбук", title: ["Соль"], author: "Илья Верес", code: "справочник / 2026", mark: "Na" }
  };

  function coverHTML(key, options) {
    options = options || {};
    var data = coverData[key] || coverData.sol;
    var lines = data.title.map(function (line) { return "<span>" + esc(line) + "</span>"; }).join("");
    return '<span class="book-cover bc--' + esc(key) + (options.large ? " bc--large" : "") + '" aria-label="Обложка: ' + esc(data.title.join(" ")) + '">' +
      '<span class="bc-kicker">' + esc(data.kicker) + "</span>" +
      '<span class="bc-title">' + lines + "</span>" +
      '<span class="bc-rule"></span>' +
      '<span class="bc-author">' + esc(data.author) + "</span>" +
      '<span class="bc-code">' + esc(data.code) + "</span>" +
      '<span class="bc-mark">' + esc(data.mark) + "</span>" +
      "</span>";
  }

  var nav = [
    { label: "Библиотека", href: "library.html", pages: ["library"] },
    { label: "Главы", href: "book.html", pages: ["book", "chapter"] },
    { label: "Мир", href: "world.html", pages: ["world", "characters", "locations", "corporations", "implants", "weapons", "dossier"] },
    { label: "Галерея", href: "gallery.html", pages: ["gallery"] },
    { label: "Автор", href: "about.html", pages: ["about"] }
  ];

  function pageName() {
    if (doc.body && doc.body.dataset.page) return doc.body.dataset.page;
    return "home";
  }

  function headerHTML() {
    var current = pageName();
    var links = nav.map(function (item) {
      var active = item.pages.indexOf(current) !== -1;
      return '<a href="' + item.href + '"' + (active ? ' aria-current="page"' : "") + ">" + esc(item.label) + "</a>";
    }).join("");
    return '<header class="site-header">' +
      '<div class="wrap header-inner">' +
        '<a class="brand" href="index.html" aria-label="Соляной протокол, на главную">' +
          '<span class="brand-mark">Соляной протокол</span>' +
          '<span class="brand-sub">архив / роман</span>' +
        "</a>" +
        '<nav class="main-nav" aria-label="Основная навигация">' + links + "</nav>" +
        '<div class="header-tools">' +
          '<button class="search-open" type="button" data-open-search aria-label="Открыть поиск">' +
            '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 21 21"></path></svg>' +
            '<span>Поиск</span><kbd>Ctrl K</kbd>' +
          "</button>" +
          '<button class="layer-toggle" type="button" data-layer-toggle aria-pressed="false" title="Показать служебные пометки">' +
            '<span class="dot" aria-hidden="true"></span><span class="layer-label">Слой 2</span>' +
          "</button>" +
          '<button class="menu-toggle" type="button" data-open-menu aria-label="Открыть меню" aria-expanded="false"><span></span></button>' +
        "</div>" +
      "</div>" +
    "</header>";
  }

  function footerHTML() {
    return '<footer class="site-footer">' +
      '<div class="wrap">' +
        '<div class="footer-grid">' +
          '<div><h3>Архив</h3><a href="library.html">Библиотека</a><a href="book.html">Соляной протокол</a><a href="gallery.html">Галерея пластин</a><a href="about.html">Об авторе</a></div>' +
          '<div><h3>Мир</h3><a href="characters.html">Персонажи</a><a href="locations.html">Локации</a><a href="corporations.html">Организации</a><a href="implants.html">Имплантаты</a><a href="weapons.html">Вооружение</a></div>' +
          '<div><h3>Служебное</h3><a href="world.html">Разрез Кассия</a><a href="book.html#contents">Содержание</a><a href="about.html#credits">Изображения и лицензии</a><a href="about.html#project">О проекте</a></div>' +
          '<div><h3>Колофон</h3><p class="footer-note">Демонстрационный артбук-архив. Книга, автор и город вымышлены. Фотографии взяты по свободным лицензиям, авторы указаны в кредитах.</p></div>' +
        "</div>" +
        '<div class="footer-bottom">' +
          '<p class="meta">© 2026 Илья Верес. Демонстрационные материалы.</p>' +
          '<p class="meta">Кассий / 34 главы / слой 2</p>' +
        "</div>" +
      "</div>" +
    "</footer>";
  }

  function dialogHTML() {
    return '<dialog class="search-dialog" id="search-dialog" aria-label="Поиск по архиву">' +
      '<div class="dialog-head"><span class="dialog-title">Поиск по архиву</span><button class="dialog-close" type="button" data-close-search aria-label="Закрыть поиск">×</button></div>' +
      '<div class="dialog-body">' +
        '<div class="search-field">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5 21 21"></path></svg>' +
          '<input type="search" id="search-input" placeholder="Глава, имя, место, термин" autocomplete="off" spellcheck="false" aria-label="Поисковый запрос">' +
        "</div>" +
        '<p class="meta search-hint" id="search-hint">Начните вводить. Стрелки и Enter работают.</p>' +
        '<div class="search-results" id="search-results"></div>' +
      "</div>" +
    "</dialog>" +
    '<dialog class="menu-dialog" id="menu-dialog" aria-label="Меню">' +
      '<div class="dialog-head"><span class="dialog-title">Навигация</span><button class="dialog-close" type="button" data-close-menu aria-label="Закрыть меню">×</button></div>' +
      '<div class="dialog-body">' +
        '<nav class="menu-nav" aria-label="Мобильная навигация">' +
          nav.map(function (item) { return '<a href="' + item.href + '">' + esc(item.label) + "<span>перейти</span></a>"; }).join("") +
        "</nav>" +
        '<p class="meta menu-note">Второй контур: служебные пометки поверх основного текста. Включается кнопкой «Слой 2» в шапке.</p>' +
      "</div>" +
    "</dialog>";
  }

  function scrollTopHTML() {
    return '<button class="scroll-top-btn" id="scroll-top-btn" type="button" aria-label="Вернуться наверх" aria-hidden="true" tabindex="-1">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 15 7-7 7 7"></path></svg>' +
    "</button>";
  }

  function buildHeader() {
    var host = doc.getElementById("site-header");
    if (host) host.innerHTML = headerHTML();
    var footer = doc.getElementById("site-footer");
    if (footer) footer.innerHTML = footerHTML();
    var holder = doc.createElement("div");
    holder.innerHTML = dialogHTML();
    while (holder.firstChild) doc.body.appendChild(holder.firstChild);
    if (!doc.getElementById("scroll-top-btn")) {
      var topHolder = doc.createElement("div");
      topHolder.innerHTML = scrollTopHTML();
      doc.body.appendChild(topHolder.firstChild);
    }
  }

  function buildIndex() {
    var items = [];
    SITE.works.forEach(function (work) {
      items.push({ title: work.title, type: "Книга", group: "Библиотека", url: work.id === "sol" ? "book.html" : "library.html", text: work.annotation + " " + work.type + " " + work.year });
    });
    SITE.chapters.forEach(function (chapter) {
      items.push({ title: chapter.n + ". " + chapter.title, type: "Глава", group: "Главы", url: "chapter.html?n=" + chapter.n, text: chapter.synopsis || "" });
    });
    SITE.characters.forEach(function (item) {
      items.push({ title: item.name, type: "Досье", group: "Персонажи", url: "dossier.html?id=" + encodeURIComponent(item.id), text: [item.role, item.aliases, item.faction, item.quote, (item.tags || []).join(" ")].join(" ") });
    });
    SITE.locations.forEach(function (item) {
      items.push({ title: item.name, type: "Локация", group: "Локации", url: "dossier.html?id=" + encodeURIComponent(item.id), text: [item.tier, item.summary, item.control, item.access].join(" ") });
    });
    SITE.corporations.forEach(function (item) {
      items.push({ title: item.name, type: "Организация", group: "Организации", url: "dossier.html?id=" + encodeURIComponent(item.id), text: [item.sector, item.summary, item.motto].join(" ") });
    });
    SITE.implants.forEach(function (item) {
      items.push({ title: item.name, type: "Имплантат", group: "Имплантаты", url: "dossier.html?id=" + encodeURIComponent(item.id), text: [item.cls, item.maker, item.summary, item.bio].join(" ") });
    });
    SITE.weapons.forEach(function (item) {
      items.push({ title: item.name, type: "Вооружение", group: "Вооружение", url: "dossier.html?id=" + encodeURIComponent(item.id), text: [item.cls, item.maker, item.summary, item.bio].join(" ") });
    });
    SITE.glossary.forEach(function (item) {
      items.push({ title: item.term, type: "Термин", group: "Словарь", url: "world.html#term-" + (SITE.glossary.indexOf(item) + 1), text: item.text });
    });
    SITE.gallery.forEach(function (item) {
      items.push({ title: item.title, type: "Пластина", group: "Галерея", url: "gallery.html#" + item.id, text: [item.type, item.note].join(" ") });
    });
    return items;
  }

  function initSearch() {
    var dialog = doc.getElementById("search-dialog");
    var input = doc.getElementById("search-input");
    var results = doc.getElementById("search-results");
    var hint = doc.getElementById("search-hint");
    if (!dialog || !input || !results) return;
    var FuseCtor = typeof Fuse === "function" ? Fuse : (window.Fuse && window.Fuse.default);
    if (!FuseCtor) return;
    var index = buildIndex();
    var fuse = new FuseCtor(index, {
      keys: [{ name: "title", weight: 0.6 }, { name: "text", weight: 0.3 }, { name: "type", weight: 0.1 }],
      threshold: 0.36,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true
    });
    var selected = 0;
    var current = [];

    function open() {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      input.value = "";
      results.innerHTML = "";
      hint.textContent = "Начните вводить. Стрелки и Enter работают.";
      window.setTimeout(function () { input.focus(); }, 30);
    }

    function close() {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    }

    function render(list) {
      current = list;
      selected = 0;
      if (!input.value.trim()) {
        results.innerHTML = "";
        hint.textContent = "Начните вводить. Стрелки и Enter работают.";
        return;
      }
      if (!list.length) {
        results.innerHTML = '<p class="search-empty">Ничего не найдено. Попробуйте «Кира», «соль» или «дамба».</p>';
        hint.textContent = "0 результатов";
        return;
      }
      var groups = {};
      list.forEach(function (item) {
        if (!groups[item.group]) groups[item.group] = [];
        groups[item.group].push(item);
      });
      var html = "";
      Object.keys(groups).forEach(function (group) {
        html += '<div class="search-group"><h3>' + esc(group) + "</h3>";
        groups[group].forEach(function (item) {
          var pos = current.indexOf(item);
          html += '<a class="search-result" href="' + esc(item.url) + '" data-pos="' + pos + '"><span class="r-title">' + esc(item.title) + '</span><span class="r-type">' + esc(item.type) + "</span></a>";
        });
        html += "</div>";
      });
      results.innerHTML = html;
      hint.textContent = list.length + " " + plural(list.length, ["результат", "результата", "результатов"]);
      mark();
    }

    function mark() {
      var nodes = results.querySelectorAll(".search-result");
      nodes.forEach(function (node, i) {
        if (i === selected) {
          node.setAttribute("aria-selected", "true");
          if (node.scrollIntoView) node.scrollIntoView({ block: "nearest" });
        } else {
          node.removeAttribute("aria-selected");
        }
      });
    }

    function onInput() {
      var query = input.value.trim();
      if (query.length < 2) {
        render([]);
        hint.textContent = "Введите хотя бы два символа.";
        return;
      }
      var found = fuse.search(query).slice(0, 30).map(function (entry) { return entry.item; });
      render(found);
    }

    function onKey(event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        selected = Math.min(selected + 1, current.length - 1);
        mark();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        selected = Math.max(selected - 1, 0);
        mark();
      } else if (event.key === "Enter") {
        if (current[selected]) {
          event.preventDefault();
          window.location.href = current[selected].url;
        }
      }
    }

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKey);
    results.addEventListener("click", function (event) {
      var link = event.target.closest(".search-result");
      if (link) close();
    });
    doc.querySelectorAll("[data-open-search]").forEach(function (button) {
      button.addEventListener("click", open);
    });
    var closer = doc.querySelector("[data-close-search]");
    if (closer) closer.addEventListener("click", close);
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close();
    });
    doc.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      } else if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(doc.activeElement.tagName)) {
        event.preventDefault();
        open();
      }
    });
  }

  function initMenu() {
    var dialog = doc.getElementById("menu-dialog");
    var opener = doc.querySelector("[data-open-menu]");
    if (!dialog || !opener) return;
    function open() {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      opener.setAttribute("aria-expanded", "true");
    }
    function close() {
      if (dialog.open) dialog.close();
      else dialog.removeAttribute("open");
      opener.setAttribute("aria-expanded", "false");
    }
    opener.addEventListener("click", open);
    var closer = doc.querySelector("[data-close-menu]");
    if (closer) closer.addEventListener("click", close);
    dialog.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", close); });
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) close();
    });
  }

  function initScrollToTop() {
    var button = doc.getElementById("scroll-top-btn");
    if (!button) return;
    var ticking = false;

    function update() {
      ticking = false;
      var visible = (window.scrollY || window.pageYOffset || 0) > 400;
      button.classList.toggle("visible", visible);
      button.setAttribute("aria-hidden", visible ? "false" : "true");
      button.tabIndex = visible ? 0 : -1;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }

    button.addEventListener("click", function () {
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  function readLayer() {
    try {
      var stored = window.localStorage.getItem("sol-layer");
      if (stored === "1" || stored === "2") return stored;
    } catch (error) { /* локальное хранилище может быть недоступно */ }
    return "1";
  }

  function setLayer(value) {
    var layer = value === "2" ? "2" : "1";
    doc.documentElement.dataset.layer = layer;
    doc.querySelectorAll("[data-layer-toggle]").forEach(function (button) {
      button.setAttribute("aria-pressed", layer === "2" ? "true" : "false");
      var label = button.querySelector(".layer-label");
      if (label) label.textContent = layer === "2" ? "Слой 2 вкл." : "Слой 2";
      button.title = layer === "2" ? "Скрыть служебные пометки" : "Показать служебные пометки";
    });
    try { window.localStorage.setItem("sol-layer", layer); } catch (error) { /* без хранилища */ }
  }

  function initLayer() {
    setLayer(readLayer());
    doc.querySelectorAll("[data-layer-toggle]").forEach(function (button) {
      button.addEventListener("click", function () {
        setLayer(doc.documentElement.dataset.layer === "2" ? "1" : "2");
      });
    });
  }

  function plural(number, forms) {
    var n = Math.abs(number) % 100;
    var n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
  }

  window.Util = {
    esc: esc,
    img: img,
    plate: plate,
    cover: coverHTML,
    plural: plural,
    chapterUrl: function (n) { return "chapter.html?n=" + n; },
    dossierUrl: function (id) { return "dossier.html?id=" + encodeURIComponent(id); },
    param: function (name, fallback) {
      try {
        var params = new URLSearchParams(window.location.search);
        return params.get(name) || fallback;
      } catch (error) {
        return fallback;
      }
    }
  };

  buildHeader();
  initSearch();
  initMenu();
  initScrollToTop();
  initLayer();
})();
