import { defineConfig } from "eslint/config";
import tseslint from "@electron-toolkit/eslint-config-ts";
import eslintConfigPrettier from "@electron-toolkit/eslint-config-prettier";
import eslintPluginVue from "eslint-plugin-vue";
import vueParser from "vue-eslint-parser";

/** 缩进采用 4 空格（规则 2）。ESLint 9 的 indent 规则即 @stylistic 的前身，仍然可用。 */
const IndentSize = 4;

/**
 * 小驼峰：函数名 / 普通变量 / 方法名（规则 9）。
 * 这里用自定义正则而不是预定义格式 'camelCase'，因为还要同时满足「禁止使用下划线」
 * （规则 11）——预定义格式不会做这种严格判断，下划线一律不通过。
 *
 * 注意：`format` 只接受预定义格式名（camelCase / PascalCase / snake_case …），
 * 把正则写进 `format` 会被 schema 直接拒绝：
 *   Key "rules": Key "@typescript-eslint/naming-convention":
 *   Value "^[a-z][a-zA-Z0-9]*$" should be equal to one of the allowed values.
 * 自定义正则一律写进 `custom`（`{ regex, match }`），同时把 `format` 置 null。
 */
const camelCaseName = "^[a-z][a-zA-Z0-9]*$";

/** 大驼峰：模块级导出的变量（即规则 10 说的「全局变量」）从大写字母开始；类型 / 类 / 枚举同样沿用。 */
const pascalCaseName = "^[A-Z][a-zA-Z0-9]*$";

/**
 * 参数名：小驼峰，或整名下划线（`(_, window) => …` 里有意不用的参数）。
 *
 * 注意 `leadingUnderscore: 'allow'` 会先剥掉前导下划线再拿去匹配，
 * 于是 `_` 剥完是空串、`_event` 剥完是 `event`，所以正则里要放行空串。
 */
const parameterName = "^$|^[a-z][a-zA-Z0-9]*$";

/** 小驼峰 / 大驼峰 → naming-convention 的 `custom` 选项（自定义正则的唯一合法位置）。 */
const match = (regex) => ({ regex, match: true });

/**
 * 规则 11 的作用对象：名字内部不得出现下划线。
 *
 * 刻意**不含 classProperty**：模块里的类属性常按表名取名
 * （`astronomy_month_weeks`、`epoch_chronologies` 这些关联表字段），
 * 那是有意的 snake_case，不属于「随手写下划线」。
 * （命名检查在生成物上另有豁免，见文件末尾 `src/datasource/*.sqlite.ts` 那一块。）
 */
const noUnderscoreSelectors = [
    "variable",
    "function",
    "parameter",
    "classMethod",
    "objectLiteralMethod",
    "typeLike"
];

/** 只放行「全部是下划线」的占位名；名字内部出现下划线即违规（规则 11）。 */
const noInnerUnderscore = "^[^_]+$|^_+$";

/**
 * 单词全称黑名单（规则 12）：命中即要求改用全称。
 * 例：idx → index、len → length、str → text、val → value、res → result、err → error、fn → callback。
 */
const abbreviations = [
    "arr",
    "attr",
    "btn",
    "cb",
    "cfg",
    "conf",
    "ctx",
    "curr",
    "dest",
    "dir",
    "doc",
    "el",
    "elem",
    "env",
    "err",
    "evt",
    "ext",
    "fn",
    "idx",
    "img",
    "len",
    "max",
    "min",
    "msg",
    "num",
    "obj",
    "param",
    "pos",
    "prev",
    "prop",
    "req",
    "res",
    "src",
    "str",
    "temp",
    "tmp",
    "val",
    // 单字母名字（n、t、b、i、j、k …）一律视为缩写
    "^[a-z]$"
];

/** 规则 12 的过滤器：名字不在黑名单里才通过。不作用于 import 与对象属性，只约束自己起的名字。 */
const noAbbreviation = {
    regex: `^(?!(${abbreviations.join("|")})$).*$`,
    match: true
};

/** 规则 12 的白名单：这一类名字来自 Node / 浏览器 / 既有库的 API，不是本项目起的，放行。 */
const libraryNames = ["err", "evt", "str", "src", "dest", "dir", "doc", "env", "ext"];

/** 需要检查命名约定的标识符种类。 */
const namedSelectors = [
    "variable",
    "function",
    "parameter",
    "classMethod",
    "classProperty",
    "objectLiteralMethod",
    "typeLike"
];

const nameRules = [
    // 兜底：其余未单独列出的标识符一律小驼峰（规则 9）
    {
        selector: "default",
        format: null,
        custom: match(camelCaseName),
        leadingUnderscore: "allow",
        trailingUnderscore: "allow",
        filter: noAbbreviation
    },
    // 外部依赖的名字不由本项目决定
    {
        selector: "import",
        format: null
    },
    // 泛型参数约定俗成用单个大写字母（T、U、R、K、V），不按变量类规则约束
    {
        selector: "typeParameter",
        format: null
    },
    // 对象字面量的键名常来自数据库列名 / 外部协议字段
    {
        selector: ["objectLiteralProperty", "typeProperty"],
        format: null
    },
    // 普通变量（规则 9）
    {
        selector: "variable",
        format: null,
        custom: match(camelCaseName),
        leadingUnderscore: "allow",
        filter: noAbbreviation
    },
    // 全局变量（projectService 眼里，模块顶层的 const 也算「全局」）。
    //
    // 这里刻意写得宽：`const MinSafe` / `const Table` 这类模块级常量在这个项目里一直写大驼峰，
    // 而 `<script setup>` 顶层的 `const route` 又是小驼峰——两者都合法，
    // 只拦 snake_case 与随手加的下划线。（只写 `format: ['PascalCase']` 会把 `route`
    // 这类正常名字也报出来，那是配置误伤，不要那样写。）
    {
        selector: "variable",
        modifiers: ["global"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        filter: noAbbreviation
    },
    // 导出后对外可见的变量：小驼峰 / 大驼峰 / 全大写下划线常量都接受
    {
        selector: "variable",
        modifiers: ["exported"],
        format: ["camelCase", "PascalCase", "UPPER_CASE"],
        filter: noAbbreviation
    },
    // 类属性：关联表字段按表名取名（`astronomy_month_weeks`、`epoch_chronologies`），
    // 是有意的 snake_case，不算违规。写了这一条，classProperty 就不再落到上面的 `default`。
    {
        selector: "classProperty",
        format: ["camelCase", "PascalCase", "snake_case", "UPPER_CASE"]
    },
    // 函数名（规则 9）
    {
        selector: "function",
        format: null,
        custom: match(camelCaseName),
        filter: noAbbreviation
    },
    // 参数（规则 9）；前导下划线用于「有意不使用的参数」，
    // 整个名字就是一个下划线（`(_, window) => …`）也放行。
    {
        selector: "parameter",
        format: null,
        custom: match(parameterName),
        leadingUnderscore: "allow",
        filter: noAbbreviation
    },
    // 方法名（规则 9）
    {
        selector: "classMethod",
        format: null,
        custom: match(camelCaseName),
        filter: noAbbreviation
    },
    {
        selector: "objectLiteralMethod",
        format: null,
        custom: match(camelCaseName),
        filter: noAbbreviation
    },
    // 私有字段允许前导下划线
    {
        selector: "classProperty",
        modifiers: ["private"],
        format: null,
        custom: match(camelCaseName),
        leadingUnderscore: "allow",
        filter: noAbbreviation
    },
    // 类型 / 接口 / 类 / 枚举（规则 10 的大驼峰统一沿用）
    {
        selector: "typeLike",
        format: null,
        custom: match(pascalCaseName)
    },
    {
        selector: "enumMember",
        format: null,
        custom: match(pascalCaseName)
    },
    // 禁止使用下划线（规则 11）：名字内部出现下划线即报错，前导 / 尾随下划线除外。
    // 作用对象见 noUnderscoreSelectors：类属性（关联表字段）不在其中。
    {
        selector: noUnderscoreSelectors,
        format: null,
        custom: match(noInnerUnderscore)
    },
    // 禁止缩写（规则 12）在既有库 API 上的豁免。
    // 这里只能写成 filter：`filter` 决定「哪些名字受本条约束」，`custom` 是「必须匹配的正则」，
    // 两者语义相反——豁免只能用 filter。既有库那几个名字本来就在 abbreviations 黑名单里，
    // 已被各条 format 规则的 `filter: noAbbreviation` 排除在外，本条只作显式备案。
    {
        selector: namedSelectors,
        format: null,
        filter: { regex: `^(${libraryNames.join("|")})$`, match: true }
    }
];

export default defineConfig(
    { ignores: ["**/node_modules", "**/dist", "**/out"] },
    tseslint.configs.recommended,
    eslintPluginVue.configs["flat/recommended"],
    {
        files: ["**/*.vue"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true
                },
                extraFileExtensions: [".vue"],
                parser: tseslint.parser
            }
        }
    },
    {
        files: ["**/*.{ts,mts,tsx,vue}"],
        languageOptions: {
            parserOptions: {
                // 命名约定需要类型信息才能区分全局变量 / 局部变量 / 参数，
                // 因此开启 projectService：解析器按各文件所属的 tsconfig 自动解析类型信息。
                // `scripts/smoke/*.ts` 不在任何 tsconfig 的 include 里（它是跑一次就丢的冒烟脚本），
                // 放进 allowDefaultProject 让它至少能被解析，否则整份文件只报一条 Parsing error。
                projectService: {
                    allowDefaultProject: ["scripts/smoke/*.ts"]
                }
            }
        },
        rules: {
            "vue/require-default-prop": "off",
            "vue/multi-word-component-names": "off",
            "vue/block-lang": [
                "error",
                {
                    script: {
                        lang: "ts"
                    }
                }
            ],

            // ── 1. 优先使用双引号 ────────────────────────────────────────────────
            quotes: ["error", "double", { avoidEscape: true, allowTemplateLiterals: true }],

            // ── 3. +-*/ 等运算符左右有空格 ──────────────────────────────────────
            "space-infix-ops": ["error", { int32Hint: false }],
            "operator-assignment": ["error", "always"],

            // ── 4. { 不换行；5. } 在新行 ────────────────────────────────────────
            // consistent: { 后不换行时 } 前也不换行，于是 } 永远跟在最后一项之后，
            // 不会出现「} 独占一行、而 { 也独占一行」的写法。
            "object-curly-newline": [
                "error",
                {
                    ObjectExpression: { multiline: true, consistent: true },
                    ObjectPattern: { multiline: true, consistent: true },
                    ImportDeclaration: { multiline: true, consistent: true },
                    ExportDeclaration: { multiline: true, consistent: true }
                }
            ],
            "object-property-newline": ["error", { allowAllPropertiesOnSameLine: true }],

            // ── 8. 参数之间不换行 ──────────────────────────────────────────────
            "function-paren-newline": ["error", "never"],
            "function-call-argument-newline": ["error", "multiline"],

            // ── 13. 句尾必须有分号 ─────────────────────────────────────────────
            semi: ["error", "always"],
            "semi-style": ["error", "last"],

            // ── 9 / 10 / 11 / 12. 命名约定 ─────────────────────────────────────
            "@typescript-eslint/naming-convention": ["error", ...nameRules]
        }
    },
    {
        // ── 2 缩进、6 方法之间有空格、7 函数之间有空格 ────────────────────────
        files: ["**/*.{ts,mts,tsx,vue,js,mjs,cjs}"],
        rules: {
            indent: [
                "error",
                IndentSize,
                {
                    SwitchCase: 1,
                    VariableDeclarator: "first",
                    outerIIFEBody: 1,
                    MemberExpression: 1,
                    FunctionDeclaration: { parameters: "first", body: 1 },
                    FunctionExpression: { parameters: "first", body: 1 },
                    StaticBlock: { body: 1 },
                    CallExpression: { arguments: "first" },
                    ArrayExpression: "first",
                    ObjectExpression: "first",
                    ImportDeclaration: "first",
                    flatTernaryExpressions: false,
                    ignoreComments: false
                }
            ],
            "no-multi-spaces": ["error", { ignoreEOLComments: false }],
            // 6. 方法之间有空格
            "lines-between-class-members": ["error", "always", { exceptAfterSingleLine: false }],
            // 7. 函数之间有空格 / 类之间、类与函数之间留空行。
            // 注意：这里刻意不写 { prev: 'function', next: 'function' }——Prettier 会把连续两个
            // 顶层函数声明之间的空行删掉，写了这一条就会和 prettier/prettier 互相报告。
            "padding-line-between-statements": [
                "error",
                { blankLine: "always", prev: "function", next: "class" },
                { blankLine: "always", prev: "class", next: "function" }
            ]
        }
    },
    {
        // ── Vue 模板同样遵守 1 / 2 / 3 / 4 / 5 / 8 ──────────────────────────
        files: ["**/*.vue"],
        rules: {
            "vue/html-indent": [
                "error",
                IndentSize,
                {
                    attribute: 1,
                    baseIndent: 1,
                    closeBracket: 1,
                    alignAttributesVertically: true
                }
            ],
            // 允许同一行放多个属性，只在超宽时按每行 1 个换行。
            // 上限取 3 是为了不和 Prettier 打架：Prettier 一行放得下就不会拆行，
            // 若这里限制成 1，格式正确的代码也会被 lint 报错（@vue/eslint-config-prettier 用的是同一组数字）。
            "vue/max-attributes-per-line": [
                "error",
                {
                    singleline: { max: 3 },
                    multiline: { max: 1 }
                }
            ],
            // 4 / 5 在模板上的对应物：属性不换行，闭合尖括号留在最后一个属性之后（即「} 不单独成行」）
            "vue/html-closing-bracket-newline": [
                "error",
                {
                    singleline: "never",
                    multiline: "never"
                }
            ],
            "vue/html-closing-bracket-spacing": [
                "error",
                {
                    startTag: "never",
                    endTag: "never",
                    selfClosingTag: "always"
                }
            ],
            "vue/mustache-interpolation-spacing": ["error", "always"],
            "vue/html-quotes": ["error", "double"],
            "vue/attributes-order": "error",
            "vue/order-in-components": "error",
            // 组件标签一律大驼峰：写 <ElMenu> 而不是 <el-menu>。
            // registeredComponentsOnly: false 让全局注册的组件（Element Plus 在 src/plugin 里 app.use）
            // 也纳入检查，否则只检查本文件 import 进来的组件，el-menu 这类会漏过。
            "vue/component-name-in-template-casing": [
                "error",
                "PascalCase",
                {
                    registeredComponentsOnly: false
                }
            ],
            // 组件定义名（defineComponent / export default 的 name）同样大驼峰
            "vue/component-definition-name-casing": ["error", "PascalCase"],
            // <MyComponent /> 而不是 <MyComponent></MyComponent>
            "vue/html-self-closing": [
                "error",
                {
                    html: {
                        void: "always",
                        normal: "always",
                        component: "always"
                    },
                    svg: "always",
                    math: "always"
                }
            ]
        }
    },
    {
        // 构建脚本与配置文件里的名字（路径、目录、环境变量）沿用既有习惯，不做命名检查
        files: ["**/*.{js,mjs,cjs}"],
        rules: {
            "@typescript-eslint/naming-convention": "off",
            "padding-line-between-statements": "off"
        }
    },
    {
        // src/datasource/*.sqlite.ts 由 scripts/generate_datasource.py 生成（文件头写着「请勿手改」），
        // 命名不在这里约束，要改就改生成脚本；格式类规则（引号 / 缩进 / 运算符空格）仍然生效。
        files: ["src/datasource/*.sqlite.ts"],
        rules: {
            "@typescript-eslint/naming-convention": "off"
        }
    },
    eslintConfigPrettier
);
