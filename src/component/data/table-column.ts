/**
 * 数据表的列声明。
 *
 * 单独一个文件而不是从 `DataTable.vue` 里导出：`<script setup>` **不能有具名导出**，
 * 而列声明是调用方（历法数据页、数据浏览页、系统页）要拼的东西，
 * 放在 `.vue` 里就没法被 import。
 */

/** 一列的显示信息。 */
export interface TableColumn {
    /** 列名，与 SQL 里的列名一致 */
    name: string;
    /** 表头文案；不写用 `name` */
    label?: string;
    /** 数字列：右对齐 + 等宽，并格式化成千分位 */
    numeric?: boolean;
    /** 列宽（px）；不写则自适应 */
    width?: number;
}

/**
 * 按 SQLite 的类型声明判断是不是数字列。
 *
 * SQLite 是动态类型，`type` 只是声明，但本项目所有 `.sqlite` 都由
 * `database/schema.py` 生成，声明是准的（INTEGER / TEXT）。
 * 判错的后果只是对齐方式，不是数据错误。
 */
export const isNumericType = (type: string): boolean => /INT|REAL|NUM|DEC|FLOAT|DOUBLE/i.test(type);

/**
 * 打头列：人类可读的记录标识。
 *
 * NN/g 的数据表准则（`docs/ui-architecture.md` §2.4 第 5 条，已核实）：
 * "**默认第一列应是人类可读的记录标识**，而不是自动生成的 mystery meat ID"。
 * 本项目的历表里能当标识的列名就这几个，按优先级排。
 */
export const PRIMARY_COLUMN_CANDIDATES: readonly string[] = ["name", "label", "title", "year", "ordinal"];
