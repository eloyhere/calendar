# src/component/list/virtual — 固定行高的虚拟列表

`src/component/list/` 按实现分子目录（做变高虚拟列表就是再加一个 `dynamic/`）；
本目录是一套：组件 + 它的算术 + 这份说明。

| 文件               | 作用                                                          |
| ------------------ | ------------------------------------------------------------- |
| `VirtualList.vue`  | 虚拟列表：只渲染可视区里的行，每行长什么样由 `#item` 插槽决定 |
| `virtual-range.ts` | 它的算术：由滚动位置推出渲染区间；纯函数，可在 Node 里单独测  |

## 三条契约

1. **行高固定**：`itemHeight` 是多少像素，行就多高。虚拟化靠
   `scrollTop / itemHeight` 直接算下标，不测量、不抖动；变高的行会把后面的行顶偏，
   本组件不做（要做就得给每行记高度、滚动时不停修正，是另一套算法）。
2. **item 只写内容**：`#item` 里只写这一行长什么样。行容器（固定高度、`role="listitem"`）
   由组件提供，不要再套一层带高度的盒子。内容比 `itemHeight` 高会在开发期收到 `console.warn`。
3. **高度要有来源**：`height` 默认 `320px`；给 `"100%"` 时父容器必须有确定高度，
   否则视口塌成 0、一行都看不到（`ResizeObserver` 量到高度后会自己恢复）。

## 用法

```vue
<script setup lang="ts">
import { ref, useTemplateRef } from "vue";

import VirtualList from "../../../component/list/virtual/VirtualList.vue";
import EmptyState from "../../../component/state/EmptyState.vue";

interface YearRow {
    identity: number;
    year: number;
    label: string;
}

const list = useTemplateRef("list");
const rows = ref<Array<YearRow>>([]);

/** `fetchPage()` 示意：接 `src/service/<entity>.service.ts`，按 offset 取一页。 */
let loading = false;

async function loadMore(): Promise<void> {
    if (loading) {
        return;
    }
    loading = true;
    rows.value = [...rows.value, ...(await fetchPage(rows.value.length))];
    loading = false;
}
</script>

<template>
    <VirtualList
        ref="list"
        :items="rows"
        :item-height="32"
        height="calc(100vh - 320px)"
        :item-key="(row) => row.identity"
        @reach-end="loadMore">
        <template #item="{ item, index }">
            <div class="year-row numeral">{{ index + 1 }} / {{ item.year }} {{ item.label }}</div>
        </template>
        <template #empty>
            <EmptyState source="gregory_year" />
        </template>
    </VirtualList>
</template>
```

`#item` 的作用域参数里 `index` 是它在 `items` 里的**真实下标**（不是可视区里的第几个）。
`useTemplateRef("list")` 拿到的实例可以直接 `list.value?.scrollToIndex(1200, "center")`——
不必先把第 1200 行渲染出来。

> 上面两个 `import` 的相对层数是按 `src/view/<域>/parts/` 这一层写的，页面位置不同就增减
> `../`；也可用 `electron.vite.config.ts` 里已配好的 `@src` 别名。

## API

**props**

| 名           | 类型                                           | 默认      | 说明                                    |
| ------------ | ---------------------------------------------- | --------- | --------------------------------------- |
| `items`      | `readonly T[]`                                 | `[]`      | 全部数据，通常分页追加                  |
| `itemHeight` | `number`                                       | `36`      | 行高（像素）                            |
| `height`     | `number \| string`                             | `"320px"` | 视口高度：数字按 px，字符串原样交给 CSS |
| `overscan`   | `number`                                       | `4`       | 可视区上下各多渲染几行                  |
| `itemKey`    | `(item: T, index: number) => string \| number` | 行下标    | 行的 key；整页替换数据时给个稳定 key    |

**slots**

| 名      | 作用域参数                   | 说明                                      |
| ------- | ---------------------------- | ----------------------------------------- |
| `item`  | `{ item: T; index: number }` | 单行内容；行容器由组件提供                |
| `empty` | —                            | 数据为空时的整块占位，通常是 `EmptyState` |

**events**

| 名          | 载荷                    | 说明                                                                                 |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `reach-end` | —                       | 末行进入渲染范围时触发一次；滚离末尾再滚回来才会再触发。首屏若一屏就到底也会触发一次 |
| `scroll`    | `{ scrollTop: number }` | 每次滚动，用于行号提示、侧边吸附等                                                   |

**expose**

| 名                                   | 说明                                                     |
| ------------------------------------ | -------------------------------------------------------- |
| `scrollToIndex(index, align?)`       | `align` 取 `start`（默认）/ `center` / `end`，结果已夹逼 |
| `scrollToTop()` / `scrollToBottom()` | 到顶 / 到底                                              |
| `scrollToOffset(offset)`             | 滚到指定像素                                             |

## 开发期自检

只在 `import.meta.env.DEV` 下，各报一次 `console.warn`：

- `itemHeight` 不是正数（会按 1px 处理）；
- 插槽内容比 `itemHeight` 高（多出来的部分会盖住下一行）。

## 为什么不用 Element Plus 的 `FixedSizeList`

`element-plus` 只把 `FixedSizeList` / `DynamicSizeList` 作为普通导出给出，没有随
`app.use(ElementPlus)` 注册成全局组件；要用就得在业务代码里写裸包名
`import { FixedSizeList } from "element-plus"`，与 `src/plugin/README.md` 的
「依赖只从 `src/plugin` 进」冲突，模板里也没有 `El` 前缀的写法。
本组件只用原生滚动容器，运行时依赖为零。

## 已验证

两个烟测都在 `scripts/smoke/` 下，Node 24 直接跑（类型擦除；导入带 `.ts` 后缀）：

```bash
node scripts/smoke/virtual-list.smoke.ts         # 算术：53 条断言
node scripts/smoke/virtual-list-render.smoke.ts  # SSR 真渲染：17 条断言
```

- **算术 53 条全过**：顶部 / 中部 / 到底 / 越界 / 空列表 / 行数不足一屏 / 视口未量到 /
  缓冲为 0 / 各类非法输入（`NaN`、负数、小数、行高 0），外加「把所有滚动位置扫一遍」的
  三条不变量（区间自洽、始终盖住可视区、首行不倒退）与 `scrollToIndex` 的对齐与夹逼。
- **SSR 渲染 17 条全过**：占位高度、平移量、只渲染 1 + overscan 行、插槽拿到的真实下标与
  数据、`aria-*`、空态插槽。
- `vue-tsc --noEmit -p tsconfig.web.json --composite false`：`src/component/list/virtual/` 下 **0 报错**
  （仓库里其余的报错都在与本次无关的既有文件上）；另用临时页面探针确认过
  `@src/component/list/virtual/VirtualList.vue` 与相对路径两种写法都能解析。
- `eslint` 与 `prettier --check`：本目录三个文件与两个烟测 **0 error / 0 warning**。
- 用临时探针组件从使用者角度调用过一次（校验完已删）：`:overscan="'2'"` 报
  「string 不能赋给 number」、`item.nope` 报「`Row` 上没有该属性」、`scrollToNope()` 报
  「不存在」——说明 prop 类型、`#item` 的 `item` 推断（由 `:items` 推出 `Row`，不是 `any`）
  与 `defineExpose` 的方法都真的过了 `vue-tsc`。

**还没验证的**：真实布局下的滚动表现（本仓库没有 DOM 测试环境，没装 jsdom / vitest）。
滚动算术与渲染结构都已覆盖，但「在 Electron 窗口里拖着滚」这一步要等第一个用它的页面。
