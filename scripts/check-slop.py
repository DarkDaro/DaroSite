#!/usr/bin/env python3
# ============================================================
# check-slop.py — линтер текстов: ИИ-штампы, плейсхолдеры, следы
# генерации. Сайт-архив романа читается людьми: текст выдаёт
# генерацию мгновенно, поэтому тексты чистятся ДО закрытия чанка.
#
# Что проверяет в *.html *.md *.txt:
#   [ОШИБКА] плейсхолдеры: TODO/FIXME/XXX, 【…】, Lorem ipsum,
#            «???», undefined/NaN в видимом тексте html
#   [ОШИБКА] следы генерации в html: упоминания нейросетей и
#            «сгенерировано…»
#   [ПРЕДУПРЕЖДЕНИЕ] стоп-лист штампов (нужен человеческий взгляд:
#            в SEO-текстах часть формулировок допустима)
#   [ПРЕДУПРЕЖДЕНИЕ] следы генерации в *.md (там они бывают легитимны —
#            журнал инцидентов и т.п.)
#
# Запуск: python3 scripts/check-slop.py [путь] [--ignore dir,dir] [--strict]
#   --strict  — предупреждения тоже ломают сборку
# Коды выхода: 0 — чисто (или только предупреждения), 1 — ошибки
# (или предупреждения при --strict).
# Без зависимостей; стоп-лист правится прямо в этом файле.
# ============================================================

import argparse
import re
import sys
from pathlib import Path

# --- стоп-лист ИИ-штампов (пополняется отдельным коммитом «контент:») ---
SLOP = [
    r"в современном мире",
    r"в наше время",
    r"с развитием технологий",
    r"играет (важную|ключевую|значимую) роль",
    r"неоценим(ый|ый вклад)",
    r"не секрет, что",
    r"стоит отметить",
    r"стоит упомянуть",
    r"важно понимать",
    r"широкий (спектр|выбор|ассортимент)",
    r"на любой вкус",
    r"каждый найдёт для себя",
    r"уникальн(ая|ые) возможност",
    r"незабываем(ые|ый)",
    r"погрузитесь в атмосферу",
    r"идеальное сочетание",
    r"динамично развивающийся",
    r"инновационный",
    r"передовые технологии",
    r"подводя итог",
    r"в заключение",
    r"таким образом,",
    r"надежда здесь не (просто|только)",
    r"осуществляется",
    r"данный (сайт|раздел|материал)",
]

# --- плейсхолдеры и следы недоделки: всегда ошибки ---
PLACEHOLDER = [
    r"\bTODO\b",
    r"\bFIXME\b",
    r"\bXXX\b",
    r"【[^】]*】",
    r"[Ll]orem [Ii]psum",
    r"\?{3,}",
    r"\bundefined\b",
    r"\bNaN\b",
]

# --- следы генерации: ошибки в html, предупреждения в md ---
AI_TRACE = [
    r"сгенерирован[оы] (с|при)",
    r"написан[оы] (при помощи|нейросетью|искусственн)",
    r"создан[оы] (при помощи|нейросетью|искусственн)",
    r"ChatGPT",
    r"OpenAI",
    r"Anthropic",
    r"\bClaude\b",
    r"Copilot",
    r"DeepSeek",
    r"\bGPT-\d",
    r"нейросет[ьи]",
]

# метафайлы проекта рассказывают О правилах и стоп-листе — цитаты в них
# не считаются находками; при необходимости выключается через --keep-meta
IGNORE_DIRS_DEFAULT = {".git", "node_modules", "out", ".github", "scripts", "rules", "vendor"}
IGNORE_FILES_DEFAULT = {"AGENTS.md", "PROJECT-META.md", "SESSIONS.md", "BACKLOG.md"}
TEXT_EXT = {".html", ".htm", ".md", ".txt"}

HTML_TAGS = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.S | re.I)
HTML_COMMENTS = re.compile(r"<!--.*?-->", re.S)


def visible_text(html: str) -> str:
    """Убирает script/style и комментарии: ищем по видимому тексту."""
    t = HTML_COMMENTS.sub(" ", html)
    t = HTML_TAGS.sub(" ", t)
    return t


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default=".")
    ap.add_argument("--ignore", default="")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--keep-meta", action="store_true",
                    help="проверять и метафайлы проекта (AGENTS/SESSIONS/BACKLOG)")
    args = ap.parse_args()

    ignore = set(IGNORE_DIRS_DEFAULT)
    ignore |= {d.strip() for d in args.ignore.split(",") if d.strip()}

    root = Path(args.path).resolve()
    errors: list[str] = []
    warns: list[str] = []

    files = [
        p
        for p in sorted(root.rglob("*"))
        if p.is_file()
        and p.suffix.lower() in TEXT_EXT
        and not any(part in ignore for part in p.parts)
        and (args.keep_meta or p.name not in IGNORE_FILES_DEFAULT)
    ]
    if not files:
        print(f"check-slop: в {root} нет текстовых файлов — проверять нечего")
        return 1

    re_slop = [re.compile(p, re.I) for p in SLOP]
    re_ph = [re.compile(p) for p in PLACEHOLDER]
    re_ai = [re.compile(p, re.I) for p in AI_TRACE]

    counts = {"штамп": 0, "плейсхолдер": 0, "след генерации": 0,
              "след генерации (md)": 0}
    for f in files:
        raw = f.read_text(encoding="utf-8", errors="replace")
        is_html = f.suffix.lower() in {".html", ".htm"}
        rel = f.relative_to(root)

        def hit(patterns, store, label, lines):
            for rx in patterns:
                for i, line in enumerate(lines, 1):
                    for m in rx.finditer(line):
                        store.append(f"{rel}:{i} — {label}: «{m.group(0)}»")
                        counts[label] += 1

        # штампы — по видимому тексту (комментарии и код не считаются);
        # плейсхолдеры и следы — по сырому: TODO в комментарии тоже след.
        hit(re_slop, warns, "штамп", visible_text(raw).split("\n") if is_html else raw.split("\n"))
        raw_lines = raw.split("\n")
        hit(re_ph, errors, "плейсхолдер", raw_lines)
        if is_html:
            hit(re_ai, errors, "след генерации", raw_lines)
        else:
            hit(re_ai, warns, "след генерации (md)", raw_lines)

    for w in warns:
        print(f"ПРЕДУПРЕЖДЕНИЕ: {w}")
    for e in errors:
        print(f"ОШИБКА: {e}")

    if errors or (args.strict and warns):
        print(
            f"\ncheck-slop: ошибок {len(errors)}, предупреждений {len(warns)} "
            f"(штампов {counts['штамп']}, плейсхолдеров {counts['плейсхолдер']}, "
            f"следов {counts['след генерации'] + counts['след генерации (md)']})."
        )
        return 1
    print(
        f"check-slop: OK — файлов {len(files)}, ошибок 0, "
        f"предупреждений {len(warns)} (штампов {counts['штамп']}, "
        f"следов {counts['след генерации'] + counts['след генерации (md)']})."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
