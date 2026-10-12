"""解析 zh.wikipedia 的朝代表与年号表，产出结构化 JSON。

输入（由 scripts/fetch_history_sources.py 取得）：`scripts/zhwiki_dynasty.wiki.txt`、
`scripts/zhwiki_era.wiki.txt`；输出：`scripts/history.json`。

只做机械解析，不做任何"补全"：解析不到的字段留空，由 database/dynasty.py、
database/era.py 的生成脚本决定取用哪些。中文数字与"公元前"一律换成带符号整数，
-841 表示公元前 841 年；历史纪年没有 0 年，0 年按公元前 1 年的后一年处理时不使用。
"""

from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

# 公元前 841 年 = -841，公元 618 年 = 618
NUMBER = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "百": 100}
CN_DIGITS = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
#: 保护链接文本里的竖线，避免把单元格切碎
PIPE_HOLDER = "\ue000"
#: 保护模板，避免模板内的竖线干扰单元格切分；剥离正文时再删掉
TEMPLATE_HOLDER = "\ue001"
#: 单元格属性前缀：`style="background:#FFCC99" width=10%|`、`colspan=4|`、`rowspan="2"|`
ATTRIBUTE = re.compile(
    r"^(?:(?:style|class|colspan|rowspan|align|valign|width|height|bgcolor|id|title|data-\w+)"
    r"\s*=\s*(?:\"[^\"]*\"|'[^']*'|[^\s|]*)\s*)+"
    r"(?:\|[^\S\n]*)?"
)


def strip_wiki(text: str) -> str:
    """去掉 wiki 标记，留下纯文本。"""
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\{\{NoteTag.*?\}\}", "", text, flags=re.S)
    text = re.sub(r"\{\{sfn.*?\}\}", "", text, flags=re.S)
    text = re.sub(r"\{\{le\|([^}|]+).*?\}\}", r"\1", text)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"<hr\s*/?>", " ", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\[\[[^\]|]*\|([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"'{2,}", "", text)
    text = text.replace("{{!w}}", " ")
    return re.sub(r"\s+", " ", text).strip()


def cn_number(text: str) -> int | None:
    """中文数字转阿拉伯数字，支持"十八""二十四""三百"。"""
    text = text.strip()
    if not text:
        return None
    if text.isdigit():
        return int(text)
    total = 0
    section = 0
    number = 0
    for char in text:
        if char in CN_DIGITS:
            number = CN_DIGITS[char]
        elif char == "十":
            section += (number or 1) * 10
            number = 0
        elif char == "百":
            section += (number or 1) * 100
            number = 0
        elif char == "千":
            section += (number or 1) * 1000
            number = 0
        elif char == "萬" or char == "万":
            total += (section + number or 1) * 10000
            section = 0
            number = 0
    return total + section + number


YEAR = re.compile(r"(公元前|前|公元|後|后)?\s*(\d{1,4}|[零〇一二三四五六七八九十百千]+)\s*年")


def parse_year(text: str) -> int | None:
    """`公元前2070年` -> -2070，`618年` -> 618。"""
    matched = YEAR.search(text)
    if not matched:
        return None
    era, raw = matched.groups()
    if raw.isdigit():
        value = int(raw)
    else:
        value = cn_number(raw)
        if value is None:
            return None
    if era in ("公元前", "前"):
        return -value
    return value


def parse_span(text: str) -> tuple[int | None, int | None, str]:
    """`前140年－前135年` -> (-140, -135, "前140年－前135年")。"""
    cleaned = text.strip()
    # 起讫之间可能是 － - — ~ 或"至"
    pieces = re.split(r"[－—–\-~～至]", cleaned, maxsplit=1)
    if len(pieces) == 2:
        return parse_year(pieces[0]), parse_year(pieces[1]), cleaned
    year = parse_year(cleaned)
    return year, year, cleaned


def wikitable_bodies(text: str) -> list[str]:
    """切出每个顶层 wikitable 的内容。

    不能直接用 `\\{\\|(.*?)\\n\\|\\}`：维基语法里表格可以嵌套，
    非贪婪匹配会把子表与外层表粘在一起，导致表头（君主行）丢失。
    这里按 `{|` / `|}` 的深度配对，只取深度为 0 的那一层。
    """
    bodies: list[str] = []
    depth = 0
    current: list[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("{|"):
            depth += 1
            if depth == 1:
                current = []
                continue
        elif stripped.startswith("|}"):
            depth -= 1
            if depth == 0:
                bodies.append("\n".join(current))
                current = []
                continue
        if depth >= 1:
            current.append(line)
    return bodies


def split_rows(table: str) -> list[list[str]]:
    """把 wikitable 切成"单元格列表的列表"，每个 `|-` 起一行。

    单元格行以 `|`（数据）或 `!`（表头）开头，用 `||` / `!!` 分隔。
    分隔时必须跳过 `[[...]]` 内部的竖线 —— 年号表里大量出现
    `[[建元 (西汉)|建元]]` 这种写法，笼统按 `|` 切会把它切碎。
    """
    protected = re.sub(r"<!--.*?-->", "", table, flags=re.S)
    protected = re.sub(r"\{\{[^{}]*\}\}", TEMPLATE_HOLDER, protected)

    rows: list[list[str]] = []
    for chunk in re.split(r"\n\|-+", protected):
        cells: list[str] = []
        for line in chunk.split("\n"):
            if line.startswith("|+") or line.startswith("|}"):
                continue
            if line.startswith("|") or line.startswith("!"):
                body = line[1:]
                # 只剥离真正的单元格属性（style= / colspan= / rowspan= / class= …），
                # 不能笼统地"去掉第一个 | 之前的内容"——那样会把含竖线的正文吃掉。
                body = ATTRIBUTE.sub("", body, count=1)
                cells.extend(split_cells(body))
        cleaned = [
            cell.replace(TEMPLATE_HOLDER, "")
            for cell in cells
            if cell.replace(TEMPLATE_HOLDER, "").strip() != ""
        ]
        if cleaned:
            rows.append(cleaned)
    return rows


def split_cells(body: str) -> list[str]:
    """按 `||` / `!!` 拆单元格，但跳过 `[[...]]` 内部的竖线。"""
    cells: list[str] = []
    buffer: list[str] = []
    depth = 0
    index = 0
    length = len(body)
    while index < length:
        pair = body[index : index + 2]
        if pair == "[[":
            depth += 1
            buffer.append(pair)
            index += 2
            continue
        if pair == "]]":
            depth = max(0, depth - 1)
            buffer.append(pair)
            index += 2
            continue
        if depth == 0 and pair in ("||", "!!"):
            cells.append("".join(buffer))
            buffer = []
            index += 2
            continue
        buffer.append(body[index])
        index += 1
    cells.append("".join(buffer))
    return cells


def parse_dynasties(text: str) -> list[dict[str, object]]:
    bodies = wikitable_bodies(text)
    if not bodies:
        return []
    table = max(bodies, key=len)
    dynasties: list[dict[str, object]] = []
    for cells in split_rows(table):
        plain = [strip_wiki(cell) for cell in cells]
        plain = [cell for cell in plain if cell not in ("", "style=background:#ffaabb;")]
        if len(plain) < 4:
            continue
        name = plain[0]
        if not name or name in ("朝代", "國姓", "国姓") or "列表" in name:
            continue
        begin = end = None
        for cell in plain[1:5]:
            if begin is None and "年" in cell:
                begin = parse_year(cell)
            elif begin is not None and end is None and "年" in cell:
                end = parse_year(cell)
        if begin is None:
            continue
        dynasties.append({"name": name, "begin": begin, "end": end, "raw": plain[:6]})
    return dynasties


def _looks_like_era(plain: list[str]) -> bool:
    """判断一行是否本身就是一条年号记录（有起讫年份），而不是君主行。"""
    return len(plain) >= 2 and "年" in plain[1] and bool(re.search(r"\d|元", plain[1]))


def parse_eras(text: str) -> list[dict[str, object]]:
    """按 `|+ '''[[西汉]]年號'''` 分块，块内每行一个年号。"""
    eras: list[dict[str, object]] = []
    for table in wikitable_bodies(text):
        caption = re.search(r"\|\+\s*(.*)", table)
        if not caption:
            continue
        dynasty = strip_wiki(caption.group(1)).replace("年號", "").replace("年号", "").strip()
        if not dynasty:
            continue
        ruler = ""
        for cells in split_rows(table):
            plain = [strip_wiki(cell) for cell in cells]
            joined = " ".join(plain)
            # 君主行形如 `[[汉武帝]]劉徹（在位：前141年－前87年）`，用"在位"识别；
            # 只有不落进年号格式的行才当君主行，避免把带 rowspan 的年号行误判。
            if "在位" in joined and not _looks_like_era(plain):
                matched = re.search(r"([^\s（(]+)\s*[（(]在位", joined)
                ruler = matched.group(1) if matched else joined
                continue
            if len(plain) < 2 or not plain[0]:
                continue
            span = plain[1]
            if "年" not in span:
                continue
            begin, end, raw = parse_span(span)
            if begin is None:
                continue
            eras.append(
                {
                    "name": plain[0],
                    "dynasty": dynasty,
                    "ruler": ruler,
                    "begin": begin,
                    "end": end,
                    "span": raw,
                    "years": plain[2] if len(plain) > 2 else "",
                }
            )
    return eras


API = "https://zh.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "calendar-dataset/1.0"}


def fetch_wikitext(page: str) -> str:
    """取条目的维基文本；取不到就直接报错，不做静默降级。"""
    query = urllib.parse.urlencode(
        {"action": "parse", "page": page, "prop": "wikitext", "format": "json", "formatversion": "2"}
    )
    request = urllib.request.Request(f"{API}?{query}", headers=HEADERS)
    with urllib.request.urlopen(request, timeout=90) as response:
        payload = json.loads(response.read().decode("utf-8"))
    text = payload.get("parse", {}).get("wikitext", "")
    if not text:
        raise RuntimeError(f"未能取得「{page}」的维基文本；请检查网络后重试。")
    return text


def main() -> int:
    root = Path(__file__).resolve().parent
    dynasty_text = fetch_wikitext("中国朝代")
    era_text = fetch_wikitext("中国年号列表")

    dynasties = parse_dynasties(dynasty_text)
    eras = parse_eras(era_text)
    payload = {"dynasties": dynasties, "eras": eras}
    (root / "history.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"朝代 {len(dynasties)} 条，年号 {len(eras)} 条 -> scripts/history.json")
    print("朝代前 12：", [(d["name"], d["begin"], d["end"]) for d in dynasties[:12]])
    print("年号前 8：", [(e["name"], e["dynasty"], e["begin"], e["end"]) for e in eras[:8]])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
