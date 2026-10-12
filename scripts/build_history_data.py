"""整理朝代、年号、事件三份数据，供 `database/{dynasty,era,event}.py` 装库。

    python scripts/build_history_data.py

时间轴与分期（按用户定义）：

    上古        盘古          -9999 …
    神话        伏羲 … 舜     伏羲为神话朝代的第一个年号
    历史        夏 … 清        年号按历史典籍
    现代        中华民国 1912-1949   年号「民国」
                当代     1949-       年号为「」（空字符，故 year 表无对应年号记录）

数据来源：zh.wikipedia「中国朝代」条目的渲染表格（朝代起讫）与「中国年号列表」
条目（年号起讫、君主），清洗、繁简转换后落到 `database/data/*.csv`。
神话部分用传统纪年（黄帝元年 = -2697，与项目建元 -2696-03-11 相衔接）。
"""

from __future__ import annotations

import csv
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "database" / "data"
API = "https://zh.wikipedia.org/w/api.php"
HEADERS = {"User-Agent": "calendar-dataset/1.0"}
NOTE = re.compile(r"\[註[^\]]*\]|\[注[^\]]*\]")
BRACKET = re.compile(r"[（(][^）)]*[）)]")

#: 上古：盘古，按传统纪年置于时间轴最前端
ANCIENT: list[dict[str, object]] = [
    {"name": "盘古", "begin": -9999, "end": -2853, "kind": "上古"},
]

#: 神话：伏羲起，至舜。黄帝元年取 -2697，与建元 -2696-03-11 相接。
MYTH: list[dict[str, object]] = [
    {"name": "伏羲", "begin": -2852, "end": -2738, "kind": "神话"},
    {"name": "女娲", "begin": -2737, "end": -2708, "kind": "神话"},
    {"name": "神农", "begin": -2707, "end": -2698, "kind": "神话"},
    {"name": "黄帝", "begin": -2697, "end": -2598, "kind": "神话"},
    {"name": "颛顼", "begin": -2597, "end": -2514, "kind": "神话"},
    {"name": "帝喾", "begin": -2513, "end": -2436, "kind": "神话"},
    {"name": "尧", "begin": -2435, "end": -2336, "kind": "神话"},
    {"name": "舜", "begin": -2335, "end": -2071, "kind": "神话"},
]

#: 神话朝代的年号：伏羲是第一个年号，其后各代依此类推
MYTH_ERA_BEGIN = -2852
MYTH_ERA_END = -2071

#: 现代：中华民国与当代
MODERN: list[dict[str, object]] = [
    {"name": "中华民国", "begin": 1912, "end": 1949, "kind": "现代"},
    {"name": "当代", "begin": 1949, "end": None, "kind": "现代"},
]

#: 现代年号：民国 1912-1949；当代年号为「」（空字符），故不入年号表
MODERN_ERAS: list[dict[str, object]] = [
    {"name": "民国", "regime": "中华民国", "ruler": "", "begin": 1912, "end": 1949, "years": "38年"},
]

#: 政权名（年号表的 caption）-> 朝代名，用于把年号挂到正确朝代
REGIME_ALIAS: dict[str, str] = {
    "西汉": "西汉", "东汉": "东汉", "蜀汉": "蜀汉", "孙吴": "东吴", "吴": "东吴",
    "曹魏": "曹魏", "西晋": "西晋", "东晋": "东晋", "刘宋": "刘宋", "南齐": "南齐",
    "梁": "梁朝", "陈": "陈朝", "北魏": "北魏", "东魏": "东魏", "西魏": "西魏",
    "北齐": "北齐", "北周": "北周", "隋朝": "隋朝", "唐朝": "唐朝", "武周": "武周",
    "后梁": "后梁", "后唐": "后唐", "后晋": "后晋", "後汉": "后汉", "后汉": "后汉",
    "后周": "后周", "北宋": "北宋", "南宋": "南宋", "辽朝": "辽朝", "西辽": "西辽",
    "金朝": "金朝", "西夏": "西夏", "元朝": "元朝", "北元": "北元", "明朝": "明朝",
    "南明": "南明", "后金": "后金", "清朝": "清朝", "新朝": "新朝", "更始": "新朝",
    "前凉": "前凉", "前燕": "前燕", "前秦": "前秦", "后秦": "后秦", "后赵": "后赵",
    "后燕": "后燕", "后凉": "后凉", "成汉": "成汉", "汉赵": "汉赵", "南凉": "南凉",
    "北凉": "北凉", "西凉": "西凉", "南燕": "南燕", "西秦": "西秦", "北燕": "北燕",
    "前蜀": "前蜀", "后蜀": "后蜀", "南唐": "南唐", "北汉": "北汉", "南汉": "南汉",
    "吴越": "吴越", "闽": "闽", "楚": "楚", "荆南（南平）": "荆南", "荆南": "荆南",
    "隋": "隋朝", "唐": "唐朝", "宋": "宋朝", "辽": "辽朝", "金": "金朝",
    "元": "元朝", "明": "明朝", "清": "清朝", "民国": "中华民国",
}


def to_simplified(words: list[str]) -> dict[str, str]:
    """批量把繁体词转成简体（zh-cn 变体）。"""
    result: dict[str, str] = {}
    batch = 80
    for start in range(0, len(words), batch):
        chunk = words[start : start + batch]
        query = urllib.parse.urlencode(
            {
                "action": "parse",
                "text": "|".join(chunk),
                "contentmodel": "wikitext",
                "prop": "text",
                "format": "json",
                "formatversion": "2",
                "variant": "zh-cn",
            }
        )
        request = urllib.request.Request(f"{API}?{query}", headers=HEADERS)
        for attempt in range(5):
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                break
            except Exception as error:  # noqa: BLE001
                if attempt == 4:
                    raise
                print(f"    重试 {attempt + 1}：{error}")
                time.sleep(3 * (attempt + 1))
        plain = re.sub(r"<[^>]+>", "", payload["parse"]["text"]).strip()
        converted = [part.strip() for part in plain.split("|")]
        if len(converted) != len(chunk):
            raise ValueError(f"转换结果数量不符：{len(chunk)} -> {len(converted)}")
        for original, simplified in zip(chunk, converted):
            result[original] = simplified
    return result


def clean_name(text: str) -> str:
    return re.sub(r"\s+", "", BRACKET.sub("", NOTE.sub("", text))).strip()


def main() -> int:
    dynasty_source = ROOT / "history-dynasty-html.json"
    era_source = ROOT / "history.json"
    missing = [path.name for path in (dynasty_source, era_source) if not path.exists()]
    if missing:
        print(f"缺少中间文件：{', '.join(missing)}")
        print("请先运行：python scripts/parse_dynasty_html.py 与 python scripts/parse_history.py")
        return 1

    dynasties = json.loads(dynasty_source.read_text(encoding="utf-8"))
    eras = json.loads(era_source.read_text(encoding="utf-8"))["eras"]

    dynasty_raw = sorted({clean_name(item["name"]) for item in dynasties if clean_name(item["name"])})
    era_names = sorted({item["name"].strip() for item in eras if item["name"].strip()})
    regime_names = sorted({item["dynasty"].strip() for item in eras if item["dynasty"].strip()})
    ruler_names = sorted({item["ruler"].strip() for item in eras if item["ruler"]})
    myth_names = [item["name"] for item in MYTH]
    print(f"待转换：朝代 {len(dynasty_raw)}、年号 {len(era_names)}、政权 {len(regime_names)}、君主 {len(ruler_names)}")
    converted = to_simplified(dynasty_raw + era_names + regime_names + ruler_names + myth_names)

    def simplify(text: str) -> str:
        return converted.get(text, text)

    OUT.mkdir(parents=True, exist_ok=True)

    # ---------- 朝代 ----------
    dynasty_rows: list[dict[str, object]] = []
    seen: set[str] = set()
    for item in ANCIENT + MYTH:
        dynasty_rows.append({"name": item["name"], "kind": item["kind"], "begin": item["begin"], "end": item["end"]})
        seen.add(str(item["name"]))
    for item in dynasties:
        name = simplify(clean_name(item["name"]))
        # 元朝的"北元"、明朝的"南明"等并列政权由源表自己列出，保持原样
        if not name or name in seen or item["begin"] is None:
            continue
        seen.add(name)
        dynasty_rows.append(
            {
                "name": name,
                "kind": "历史",
                "begin": item["begin"],
                "end": item["end"] if item["end"] is not None else "",
            }
        )
    for item in MODERN:
        dynasty_rows.append(
            {
                "name": item["name"],
                "kind": item["kind"],
                "begin": item["begin"],
                "end": item["end"] if item["end"] is not None else "",
            }
        )
    dynasty_rows.sort(key=lambda row: (int(row["begin"]), str(row["name"])))
    _write(OUT / "dynasty.csv", ["name", "kind", "begin", "end"], dynasty_rows)
    dynasty_by_name = {str(row["name"]): row for row in dynasty_rows}

    # ---------- 年号 ----------
    era_rows: list[dict[str, object]] = []
    # 神话朝代：伏羲为第一个年号，覆盖整个神话时期
    era_rows.append(
        {
            "order": 1,
            "name": "伏羲",
            "kind": "神话",
            "regime": "神话",
            "ruler": "伏羲",
            "begin": MYTH_ERA_BEGIN,
            "end": MYTH_ERA_END,
            "years": f"{MYTH_ERA_END - MYTH_ERA_BEGIN + 1}年",
        }
    )
    for index, item in enumerate(eras, start=2):
        name = simplify(item["name"].strip())
        if not name:
            continue
        era_rows.append(
            {
                "order": index,
                "name": name,
                "kind": "历史",
                "regime": simplify(item["dynasty"].strip()),
                "ruler": simplify(item["ruler"].strip()),
                "begin": item["begin"],
                "end": item["end"] if item["end"] is not None else "",
                "years": str(item.get("years", "")).strip(),
            }
        )
    for item in MODERN_ERAS:
        era_rows.append(
            {
                "order": len(era_rows) + 2,
                "name": item["name"],
                "kind": "现代",
                "regime": item["regime"],
                "ruler": item["ruler"],
                "begin": item["begin"],
                "end": item["end"],
                "years": item["years"],
            }
        )
    era_rows.sort(key=lambda row: (int(row["begin"]), str(row["name"])))
    for position, row in enumerate(era_rows, start=1):
        row["order"] = position
    _write(
        OUT / "era.csv",
        ["order", "name", "kind", "regime", "ruler", "begin", "end", "years"],
        era_rows,
    )

    # ---------- 事件 ----------
    events: list[dict[str, object]] = []
    for row in dynasty_rows:
        name = str(row["name"])
        if row["begin"] != "":
            events.append(
                {
                    "kind": "dynasty_begin", "year": row["begin"], "name": f"{name}建立",
                    "subject": "", "colony": name, "cause": "",
                    "incident": f"{name}建立", "result": "", "dynasty": name, "era": "",
                }
            )
        if row["end"] != "":
            events.append(
                {
                    "kind": "dynasty_end", "year": row["end"], "name": f"{name}灭亡",
                    "subject": "", "colony": name, "cause": "",
                    "incident": f"{name}灭亡", "result": "", "dynasty": name, "era": "",
                }
            )
    for row in era_rows:
        name = str(row["name"])
        # 当代年号为空字符，不产生事件
        if name.strip() == "":
            continue
        if row["begin"] != "":
            events.append(
                {
                    "kind": "era_begin", "year": row["begin"], "name": f"改元{name}",
                    "subject": row["ruler"], "colony": row["regime"], "cause": "",
                    "incident": f"{row['regime']}{row['ruler']}改元{name}", "result": "",
                    "dynasty": REGIME_ALIAS.get(str(row["regime"]), ""), "era": name,
                }
            )
        if row["end"] != "":
            events.append(
                {
                    "kind": "era_end", "year": row["end"], "name": f"{name}终止",
                    "subject": row["ruler"], "colony": row["regime"], "cause": "",
                    "incident": f"{name}年号终止", "result": "",
                    "dynasty": REGIME_ALIAS.get(str(row["regime"]), ""), "era": name,
                }
            )
    # 同一年内按"朝代灭亡 -> 朝代建立 -> 改元 -> 年号终止"排序，
    # 这样 1912 年读作"清朝灭亡、中华民国建立"，1949 年读作"民国终止、当代建立"。
    kind_order = {"dynasty_end": 0, "dynasty_begin": 1, "era_begin": 2, "era_end": 3}
    events.sort(key=lambda row: (int(row["year"]), kind_order.get(str(row["kind"]), 9), str(row["name"])))
    _write(
        OUT / "event.csv",
        ["kind", "year", "name", "subject", "colony", "cause", "incident", "result", "dynasty", "era"],
        events,
    )

    legendary = sum(1 for row in dynasty_rows if row["kind"] in ("上古", "神话"))
    print(
        f"写出：朝代 {len(dynasty_rows)}（上古/神话 {legendary}）、"
        f"年号 {len(era_rows)}、事件 {len(events)} -> {OUT}"
    )
    print("事件分布：", {k: sum(1 for r in events if r['kind'] == k) for k in sorted({str(r['kind']) for r in events})})
    print("前 6 个朝代：", [(r["name"], r["kind"], r["begin"], r["end"]) for r in dynasty_rows[:6]])
    print("最后 4 个朝代：", [(r["name"], r["kind"], r["begin"], r["end"]) for r in dynasty_rows[-4:]])
    print("最后 3 个年号：", [(r["name"], r["regime"], r["begin"], r["end"]) for r in era_rows[-3:]])
    return 0


def _write(path: Path, fields: list[str], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


if __name__ == "__main__":
    raise SystemExit(main())
