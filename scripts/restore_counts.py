"""把删多了的"数量"列补回 `database/schema.py`。

按约定，实体里的**复数集合字段**（`Array<X>`，如 `months`、`weeks`、`parts`）
一律落成关联表（`<父表>_<复数>`），主表里不再有这一列。

但同名的**数量列**（bigint，注释形如"本年月数"）是基数信息，不是集合本身，
应当保留。上一轮清理按列名一刀切，把它们一并删掉了，这里补回。

    python scripts/restore_counts.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "database" / "schema.py"

#: 表名 -> [(列名, 类型, 注释)]，按原定义补回
RESTORE: dict[str, list[tuple[str, str, str]]] = {
    "synodic_calendar_year": [("months", "bigint", "本块内的朔望月数量")],
    "epoch": [("months", "bigint", "本世包含的朔望月数，30")],
    "perform": [("epoches", "bigint", "本运包含的世数，12")],
    "encounter": [("performs", "bigint", "本会包含的运数，30")],
    "primary": [("performs", "bigint", "本元包含的运数，360")],
    "dynasty": [
        ("eras", "bigint", "本朝年号数"),
        ("chronologies", "bigint", "本朝纪年数，待历史年表接入后填充"),
    ],
}

#: 七部派生历法的年表 / 月表，统一补四列 / 三列
CALENDARS = ("astronomy", "climate", "gregory", "jupiter", "natural", "tree", "tropical")
YEAR_COUNTS = [
    ("months", "bigint", "本年月数"),
    ("phenologies", "bigint", "本年候数"),
    ("weeks", "bigint", "本年周数"),
    ("parts", "bigint", "本年旬数"),
]
MONTH_COUNTS = [
    ("phenologies", "bigint", "本月候数"),
    ("weeks", "bigint", "本月周数"),
    ("parts", "bigint", "本月旬数"),
]


def column(name: str, kind: str, note: str) -> str:
    return f'            Column("{name}", "{kind}", "{note}"),'


def insert_after_last_bigint(block: str, additions: list[str]) -> str:
    """把补回的列插在最后一个 bigint/boolean 列之后（即 start/end 之前）。"""
    lines = block.split("\n")
    last = -1
    for index, line in enumerate(lines):
        if re.match(r'\s*Column\("\w+", "(bigint|boolean)"', line):
            last = index
    if last == -1:
        return block
    return "\n".join(lines[: last + 1] + additions + lines[last + 1 :])


def table_blocks(text: str) -> list[tuple[str, int, int]]:
    """返回 [(表名, 起始行, 结束行)]。

    `Table(...)` 在 `TABLES` 列表里缩进 4 空格，而在 `_DERIVED_CALENDARS`
    的循环里缩进 8 空格，因此两种缩进都要认。
    """
    blocks: list[tuple[str, int, int]] = []
    lines = text.split("\n")
    start: int | None = None
    depth = 0
    name = ""
    for index, line in enumerate(lines):
        stripped = line.strip()
        matched = re.match(r"^name=\"(\w+)\",$", stripped)
        if matched and start is None:
            name = matched.group(1)
            depth = len(line) - len(line.lstrip())
            start = index
            continue
        if start is not None and stripped == "),":
            current = len(line) - len(line.lstrip())
            if current == depth:
                blocks.append((name, start, index))
                start = None
    return blocks


def main() -> int:
    text = SCHEMA.read_text(encoding="utf-8")
    wanted: dict[str, list[tuple[str, str, str]]] = dict(RESTORE)
    for calendar in CALENDARS:
        wanted[f"{calendar}_year"] = YEAR_COUNTS
        wanted[f"{calendar}_month"] = MONTH_COUNTS

    lines = text.split("\n")
    blocks = table_blocks(text)
    # 从后往前改，避免行号漂移
    added = 0
    for name, start, end in reversed(blocks):
        columns = wanted.get(name)
        if not columns:
            continue
        block = "\n".join(lines[start : end + 1])
        present = set(re.findall(r'Column\("(\w+)"', block))
        additions = [column(*item) for item in columns if item[0] not in present]
        if not additions:
            continue
        new_block = insert_after_last_bigint(block, additions)
        lines[start : end + 1] = new_block.split("\n")
        added += len(additions)
        print(f"  {name:26} 补回 {len(additions)} 列")

    if added:
        SCHEMA.write_text("\n".join(lines), encoding="utf-8")
    print(f"共补回 {added} 列")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
