"""用 pandas 解析 zh.wikipedia「中国朝代」条目的渲染 HTML 表格。

维基文本里的 `rowspan`/`style` 让手写解析很容易串列，改抓渲染后的 HTML，
交给 pandas 处理跨行跨列，结果写到 `scripts/history-dynasty-html.json`。
"""

from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
from pathlib import Path

import pandas as pd

API = (
    "https://zh.wikipedia.org/w/api.php?action=parse&page=%E4%B8%AD%E5%9B%BD%E6%9C%9D%E4%BB%A3"
    "&prop=text&format=json&formatversion=2&redirects=1"
)

YEAR = re.compile(r"(公元前|前)?\s*(\d{1,4})\s*年")


def fetch() -> str:
    request = urllib.request.Request(API, headers={"User-Agent": "calendar-dataset/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.loads(response.read().decode("utf-8"))
    return payload["parse"]["text"]


def parse_year(text: str) -> int | None:
    matched = YEAR.search(text or "")
    if not matched:
        return None
    prefix, raw = matched.groups()
    value = int(raw)
    return -value if prefix in ("公元前", "前") else value


def main() -> int:
    root = Path(__file__).resolve().parent
    cache = root / "zhwiki_dynasty.html"
    if cache.exists():
        html = cache.read_text(encoding="utf-8")
    else:
        html = fetch()
        cache.write_text(html, encoding="utf-8")

    frames = pd.read_html(io.StringIO(html))
    print(f"共 {len(frames)} 张表")
    for index, frame in enumerate(frames):
        print(f"  [{index}] shape={frame.shape} columns={list(frame.columns)[:9]}")

    # 取列数最多、且含"朝代"与"建立"的表
    target = None
    for frame in frames:
        flat = " ".join(str(column) for column in frame.columns)
        if "朝代" in flat and "建立" in flat:
            target = frame
            break
    if target is None:
        print("没有找到目标表", file=sys.stderr)
        return 1

    target.columns = [
        " ".join(str(part) for part in column) if isinstance(column, tuple) else str(column)
        for column in target.columns
    ]
    name_column = next(column for column in target.columns if "朝代" in column)
    begin_column = next(column for column in target.columns if "建立" in column)
    end_column = next(column for column in target.columns if "滅亡" in column)

    records = []
    for _, row in target.iterrows():
        name = str(row[name_column]).strip()
        if not name or name in ("nan", "朝代"):
            continue
        begin = parse_year(str(row[begin_column]))
        end = parse_year(str(row[end_column]))
        if begin is None:
            continue
        records.append({"name": name, "begin": begin, "end": end})

    (root / "history-dynasty-html.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"解析出 {len(records)} 个朝代 -> scripts/history-dynasty-html.json")
    for record in records[:16]:
        print("   ", record)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
