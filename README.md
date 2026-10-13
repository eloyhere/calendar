# calendar

An Electron application with Vue and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# Windows MSI 安装包 -> dist/
$ npm run deploy

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

`npm run deploy` 做两件事：`electron-vite build` 打包源码，`electron-builder --win msi`
生成 MSI 安装程序，产物为 `dist/calendar 1.0.0.msi`（首次运行会自动下载 WiX 工具集到
`%LOCALAPPDATA%\electron-builder\Cache`）。

它刻意**不跑 `npm run build`**：`build` 里含 `npm run typecheck`，而 node 侧类型检查
目前在 `src/datasource/*.sqlite.ts` 与 `src/repository/*.repository.ts` 上有大量既有
错误，打安装包不应该被它们挡住。需要连类型检查一起跑时用
`npm run typecheck && npm run deploy`。

> `build:win` 已被删除（它等价于 NSIS 的 `.exe` 安装包，与 `deploy` 的 MSI 重复）。
> 需要 `.exe` 时用 `npx electron-builder --win nsis`。

## 冒烟测试

```bash
# 跑 scripts/smoke/ 下的全部脚本
$ npm run smoke

# 只跑名字里含 markdown 的
$ npm run smoke -- markdown

# 只列出来，不跑
$ npm run smoke -- --list
```

脚本在 `scripts/smoke/`，命名 `<被测对象>.smoke.ts`，**断言全过时退出码 0**。
它们是「跑一次就丢」的：不引测试框架，用 `console` 逐条打印 `✓` / `✗`，失败时列出
断言名并以 1 退出。对应地，`scripts/smoke/*.ts` 不在任何 `tsconfig` 的 `include` 里
（见 `eslint.config.mjs` 的 `allowDefaultProject`），因此 `npm run typecheck` 不覆盖它们。

总入口 `scripts/smoke.mts` 会先给每个脚本做一次 esbuild 打包再运行。原因不是偏好：
Node 24 能靠类型擦除直接跑 `.ts`，但**不认无扩展名的相对导入**，所以只要被测模块
往下还有一层 import，直接跑就会 `ERR_MODULE_NOT_FOUND`。叶子脚本走同一条路没有损失，
深依赖的脚本则不再需要各自记一条 esbuild 命令。唯一的例外是 `markdown-render.smoke.ts`
——它要编 `.vue`，自己用 vite 做，总入口原样放行。

总入口自己写成 `.mts` 而不是 `.cjs`：`.cjs` 里的 `require()` 会踩
`@typescript-eslint/no-require-imports`（`scripts/build-icons.cjs` 现在就带着这类报错），
而 ESM 没有这个问题，还能被 `npm run typecheck:node` 一并检查（已加进
`tsconfig.node.json` 的 `include`）。

| 脚本 | 覆盖什么 |
| --- | --- |
| `markdown-parse.smoke.ts` | Markdown 解析：块级语法、行内标记、链接协议白名单、畸形输入不抛异常 |
| `markdown-render.smoke.ts` | 卡片渲染：SFC 编译、三块插槽、每个块级分支、转义与 XSS 面 |
| `virtual-list.smoke.ts` | 虚拟列表的区间算术（纯函数） |
| `virtual-list-render.smoke.ts` | 虚拟列表渲染（SSR）与插槽参数 |
| `store-cache.smoke.ts` | store 层读穿缓存、并发合并、LRU 淘汰 |

## Code style rules

规则分布在三个文件里：`.prettierrc.yaml`（只管排版：引号、缩进、运算符空格、换行）、
`eslint.config.mjs`（排版 + 命名 + 空行）、`.editorconfig`（编辑器侧的缩进 4 空格、LF）。

```bash
# 按规则重排整个项目
$ npm run format

# 检查
$ npm run lint

# 自动修（引号、缩进、空行、组件标签大小写等可自动修的项）
$ npm run lint:fix
```

| #   | 规则                               | 落点                                                                                                                                                    |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 优先使用双引号                     | `singleQuote: false`、`quotes: double`（模板字符串按需使用；字符串里含双引号时允许单引号）                                                              |
| 2   | 缩进 4 空格                        | `tabWidth: 4`、`indent`（含 `SwitchCase`、`CallExpression.arguments`）、`vue/html-indent: 4`                                                            |
| 3   | `+ - * /` 等运算符左右有空格       | Prettier 内建、`space-infix-ops`、`operator-assignment`                                                                                                 |
| 4   | `{` 不换行                         | `object-curly-newline`（`consistent: true`）：`{` 后不换行，`}` 前也不换行，绝不单独成行                                                                |
| 5   | `}` 在新行                         | 同上（`}` 跟在最后一项之后，而不是自己占一行）                                                                                                          |
| 6   | 方法之间有空格                     | `lines-between-class-members: always`                                                                                                                   |
| 7   | 函数之间有空格                     | `padding-line-between-statements`（class↔function 之间强制空行；见下方「已知取舍」）                                                                    |
| 8   | 参数之间不换行                     | `function-paren-newline: never`、`function-call-argument-newline: multiline`                                                                            |
| 9   | 函数名 / 普通变量 / 方法名小写驼峰 | `@typescript-eslint/naming-convention`，正则 `^[a-z][a-zA-Z0-9]*$`                                                                                      |
| 10  | 全局变量大写字母开始、驼峰         | 同上的 `variable + global` 规则，正则 `^[A-Z][a-zA-Z0-9]*$`                                                                                             |
| 11  | 禁止使用下划线                     | 同上（名字内部出现 `_` 即报错；只放行 `_` 占位名与前导下划线，如 `(_event, window)`）                                                                   |
| 12  | 单词使用全称，禁止缩写             | 同上，`filter` 黑名单：`idx` `len` `str` `arr` `obj` `val` `res` `req` `err` `msg` `tmp` `fn` `cb` `el` `num` `min` `max` … 以及单字母名（`i` `n` `t`） |
| 13  | 句尾必须有分号                     | `semi: true`（Prettier 补分号）、`semi: ['error', 'always']`、`semi-style: ['error', 'last']`（分号必须在语句末尾，不能挪到下一行行首）                 |

补充约定：

- Vue 组件标签一律大驼峰：`<ElMenu>`、`<ElMenuItemGroup>`，不写 `<el-menu>`（`vue/component-name-in-template-casing`）。
- 组件定义名大驼峰（`vue/component-definition-name-casing`），空元素自闭合（`vue/html-self-closing`）。
- 命名规则需要类型信息才能区分「全局变量 / 局部变量 / 参数」，因此对 `**/*.{ts,mts,tsx,vue}` 开启了
  `parserOptions.projectService`（lint 会比纯语法检查慢一些）。
- 规则 12 的黑名单可以按项目习惯增删：改 `eslint.config.mjs` 里的 `abbreviations` 数组。
- `src/datasource/*.sqlite.ts` 由 `scripts/generate_datasource.py` 生成（文件头写着「请勿手改」），
  因此命名规则在这批文件上关闭；要改名请改生成脚本。格式类规则（引号 / 缩进 / 运算符空格）仍然生效。
  一个模块有多张表时一表一个文件（`astronomy.year.sqlite.ts` / `astronomy.month.sqlite.ts`）：
  12 条语句在每张表下同名，抄进同一个 TS 模块就是重名导出。
- 泛型参数 `T` `U` `R` `K` `V` 与 import 进来的名字不参与命名检查。

### 已知取舍

- **规则 7 只覆盖类与函数之间**：Prettier 会把连续两个顶层 `function` 声明之间的空行删掉，
  所以「函数之间必须有空行」如果写成 `padding-line-between-statements: function↔function`，
  就会和 `prettier/prettier` 互相报告（一个要求加、一个要求删）。本项目顶层基本都是
  `export const xxx = () => {}`（变量声明，不受影响），因此这条只保留了 class↔function。
  如果你的代码里确实有连续的 `function` 声明并希望强制空行，把那一行加回
  `eslint.config.mjs` 的 `padding-line-between-statements`，并接受 `prettier/prettier` 的告警。
- `src/datasource/sqlite.ts` 里的 `SCHEMA` 是一行一张表（远超 `printWidth: 100`），
  跑 `npm run format` 后 Prettier 会把每张表的列数组展开成多行，属于预期的大 diff。
