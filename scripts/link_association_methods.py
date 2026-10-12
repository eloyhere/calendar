"""把关联表仓库挂到各模块的 repository 上。

    python scripts/generate_association_methods.py   # 先生成关联表仓库
    python scripts/link_association_methods.py       # 再挂进模块类

在 `src/repository/<模块>.repository.ts` 里插入：

- 关联表仓库的 import（按路径排序，稳定可重复）；
- `public readonly <关联表名>` 属性，构造时实例化 —— 关联表各自是独立文件，
  没有跨库外键约束，实例化本身不读库，因此不需要延迟。

已存在同名属性时跳过，可反复执行。
"""

from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path
from types import ModuleType

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
sys.path.insert(0, str(ROOT))

from database.association import associations_of  # noqa: E402
from database.store import STORE_ORDER  # noqa: E402


def _load_by_path(name: str, path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"无法加载 {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


stem_of = _load_by_path("_generate_datasource", ROOT / "scripts" / "generate_datasource.py").stem_of


def pascal(name: str) -> str:
    return "".join(part.capitalize() for part in name.replace(".", "_").split("_"))


def main() -> int:
    total = 0
    for module in STORE_ORDER:
        associations = associations_of(module)
        if not associations:
            continue
        # 模块 repository 的文件名去掉了 `.calendar` 后缀（`astronomy.repository.ts`），
        # 关联表目录名与之一致。
        stem = module.replace(".calendar", "")
        path = SRC / "repository" / f"{stem}.repository.ts"
        if not path.exists():
            print(f"  跳过（模块 repository 不存在）：{path.name}")
            continue
        text = path.read_text(encoding="utf-8")

        entries: list[tuple[str, str, str]] = []
        for association in associations:
            table = association.table.name
            class_name = f"{pascal(table)}Association"
            relative = f"./{stem}/{stem_of(module, table)}.association"
            entries.append((table, class_name, relative))
        entries.sort(key=lambda item: item[2])

        # 1) import：插在最后一个 "../datasource/..." 之后
        adds = [
            f'import {{ {class_name} }} from "{relative}";'
            for table, class_name, relative in entries
            if f"import {{ {class_name} }}" not in text
        ]
        if adds:
            anchors = list(re.finditer(r'^import .*from "\.\./datasource/[^"]+";$', text, re.M))
            if not anchors:
                print(f"  跳过（找不到 import 锚点）：{path.name}")
                continue
            anchor = anchors[-1]
            text = text[: anchor.end()] + "\n" + "\n".join(adds) + text[anchor.end() :]

        # 2) 属性：插在本类第一个 public 成员之前
        properties = [
            f"    /** 关联表 {table}（{association.parent_table} × {association.target_table}）。 */\n"
            f"    public readonly {table}: {class_name} = new {class_name}();\n"
            for association, (table, class_name, _) in zip(associations, entries)
            if f"public readonly {table}:" not in text
        ]
        if properties:
            matched = re.search(r"^export class \w+[^{]*\{\n", text, re.M)
            if not matched:
                print(f"  跳过（找不到类声明）：{path.name}")
                continue
            text = (
                text[: matched.end()]
                + "\n"
                + "\n".join(properties)
                + text[matched.end() :]
            )

        path.write_text(text, encoding="utf-8")
        total += len(properties)
        print(f"  {module:20} 新增 {len(properties):>2} 个属性 -> {path.name}")
    print(f"共挂上 {total} 个关联表属性")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
