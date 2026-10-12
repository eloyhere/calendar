"""database.identity：跨库外键的 identity 解析。

主键 `identity` 是数据库自增的，因此跨库外键不能再用"绝对时间"当值，
必须指向父表真实的自增号。构建时按插入顺序为每张父表登记
「业务键 -> identity」映射，子表写库前由 `batch_write` 的 `remap` 统一换算，
各实体模块的 `rows()` 不必关心这件事。

业务键沿用各表原有的语义：

- `temporal`：绝对时间（`absolute` 秒）
- `synodic_calendar_year`：纪年块标签
- `synodic_month`：全局朔望月序号
- `phase` / `climate`：全局相/气候序号
- `dynasty` / `era`：起始年年初的绝对时间
- `primary` / `encounter` / `perform` / `epoch`：全局序号
"""

from __future__ import annotations

from dataclasses import dataclass, field

__all__ = ["Identities"]

#: 各表的业务键列名。子表的外键列里放的是"父表业务键的值"，
#: 构建时按这张表把它换成父表真实的自增 identity。
#:
#: 关键：必须与各实体模块 `rows()` 实际写进去的值一致。
#: 例如 `phenology.year` 写的是「该纪年块首个朔月的起始瞬间」（`year_identities()` 的结果），
#: 而不是纪年标签 `-9999`，所以 `synodic_calendar_year` 的业务键取 `start` 而不是
#: `gregorian_year`；同理 `synodic_month.absolute` 是全局月序（可为负），
#: 而子表的 `month` 列放的是月首绝对时间，故取 `start`。
BUSINESS_KEY: dict[str, str] = {
    # 时间表：主键就是绝对时间本身
    "temporal": "identity",
    # 候：所属纪年块按"该年首个朔月的起始瞬间"对照
    "synodic_calendar_year": "start",
    # 朔望月：子表按"月首绝对时间"对照
    "synodic_month": "start",
    "phase": "start",
    "climate": "start",
    # 历史表：子表按起始瞬间对照
    "dynasty": "start",
    "era": "start",
    "person": "start",
    "event": "start",
    # 元会运世：子表按父层的全局序号对照
    "primary": "absolute",
    "encounter": "absolute",
    "perform": "absolute",
    "epoch": "absolute",
    "chronology": "absolute",
    # 七部派生历法（行数据待换算）
    "astronomy_year": "start",
    "astronomy_month": "start",
    "climate_year": "start",
    "climate_month": "start",
    "gregory_year": "start",
    "gregory_month": "start",
    "jupiter_year": "start",
    "jupiter_month": "start",
    "natural_year": "start",
    "natural_month": "start",
    "tree_year": "start",
    "tree_month": "start",
    "tropical_year": "start",
    "tropical_month": "start",
}


@dataclass
class Identities:
    """父表的「业务键 -> identity」映射表。"""

    #: 表名 -> {业务键: identity}
    maps: dict[str, dict[object, int]] = field(default_factory=dict)
    #: 表名 -> 已写入行数（下一行的 identity）
    counters: dict[str, int] = field(default_factory=dict)

    def record(self, table_name: str, business_key: object, identity: int) -> None:
        """登记一行父表的业务键与自增号。"""
        self.maps.setdefault(table_name, {})[business_key] = identity
        self.counters[table_name] = max(self.counters.get(table_name, 0), identity)

    def next_identity(self, table_name: str) -> int:
        return self.counters.get(table_name, 0) + 1

    def resolve(self, table_name: str, business_key: object) -> int | None:
        """业务键 -> identity。"""
        return self.maps.get(table_name, {}).get(business_key)

    def business_key_of(self, table_name: str) -> str:
        return BUSINESS_KEY.get(table_name, "identity")

    def seed(self, table_name: str, keys: list[object]) -> None:
        """按顺序为一张父表预登记业务键，identity 从 1 递增。

        适用于 identity 就是插入顺序的表（层级表、年表、相、气候……）。
        """
        for order, key in enumerate(keys, start=1):
            self.maps.setdefault(table_name, {}).setdefault(key, order)
        self.counters[table_name] = len(keys)
