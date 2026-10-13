/**
 * 智能体品牌（厂商）与模型登记表。
 *
 * ## 只登记"能验证的事实"
 *
 * 每一家的接口地址与密钥申请入口都写了官方文档链接。**模型 id 会过时**——
 * 厂商改名、下线旧型号是常态，所以每条都标了 `note` 说明它的定位，
 * 界面提示"实际可用性以厂商控制台为准"。
 *
 * 为什么不在这里硬写一份"最新模型列表"：那需要联网核对，而本应用
 * 是离线桌面应用。写一份会过期的列表，比写一份诚实的短列表更糟——
 * 用户点了会 404，然后不知道是应用坏了还是模型下线了。
 *
 * ## 密钥不在这里
 *
 * 本文件**没有任何密钥字段**。密钥的形状（前缀、长度）用 `keyHint` 描述，
 * 供界面做提示；真正的值由主进程的 `safeStorage` 保管，
 * 渲染进程从头到尾拿不到它。
 */

/** 一个模型。 */
export interface AgentModel {
    /** 调用时用的 id */
    id: string;
    /** 界面上的名字 */
    label: string;
    /** 档次标签：旗舰 / 均衡 / 快速 / 推理 / 嵌入 */
    tier: string;
    /** 一句话定位 */
    note: string;
}

/** 一个品牌（厂商）。 */
export interface AgentVendor {
    /** 标识 */
    id: string;
    /** 中文名 */
    label: string;
    /** 接口基址（OpenAI 兼容的到 `/v1` 为止） */
    baseUrl: string;
    /** 密钥输入框的占位提示：厂商的密钥前缀 */
    keyHint: string;
    /** 申请密钥的入口 */
    consoleUrl: string;
    /** 入口的文案 */
    consoleLabel: string;
    /** 是不是本地推理（不需要密钥） */
    local: boolean;
    /** 一句话说明 */
    note: string;
    /** 模型 */
    models: readonly AgentModel[];
}

/**
 * 品牌登记表。
 *
 * 顺序按"这个项目的用户最可能先用哪个"排：DeepSeek 在最前（中文语境、
 * 价格与速度都好），然后是两家闭源旗舰，再是国内几家，最后是聚合与本地。
 */
export const AGENT_VENDORS: readonly AgentVendor[] = [
    {
        id: "deepseek",
        label: "DeepSeek",
        baseUrl: "https://api.deepseek.com/v1",
        keyHint: "sk-…",
        consoleUrl: "https://platform.deepseek.com/api_keys",
        consoleLabel: "platform.deepseek.com",
        local: false,
        note: "OpenAI 兼容接口。中文与推理能力都强，价格低，国内直连不需要代理。",
        models: [
            {
                id: "deepseek-chat",
                label: "DeepSeek Chat",
                tier: "均衡",
                note: "通用对话与写作，速度与质量平衡。适合本应用的大多数问答。"
            },
            {
                id: "deepseek-reasoner",
                label: "DeepSeek Reasoner",
                tier: "推理",
                note: "带思维链的推理模型。适合历法换算、干支推演这类需要一步步算的问题。"
            }
        ]
    },
    {
        id: "openai",
        label: "OpenAI",
        baseUrl: "https://api.openai.com/v1",
        keyHint: "sk-…",
        consoleUrl: "https://platform.openai.com/api-keys",
        consoleLabel: "platform.openai.com",
        local: false,
        note: "OpenAI 兼容接口的原始定义方。国内访问通常需要网络代理。",
        models: [
            { id: "gpt-4o", label: "GPT-4o", tier: "旗舰", note: "多模态通用模型，表格与图像理解好。" },
            { id: "gpt-4o-mini", label: "GPT-4o mini", tier: "快速", note: "便宜且快，适合批量整理与摘要。" },
            { id: "o3-mini", label: "o3-mini", tier: "推理", note: "小尺寸推理模型，数学与逻辑强。" }
        ]
    },
    {
        id: "anthropic",
        label: "Anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        keyHint: "sk-ant-…",
        consoleUrl: "https://console.anthropic.com/settings/keys",
        consoleLabel: "console.anthropic.com",
        local: false,
        note: "接口不是 OpenAI 形状（消息体与鉴权头都不同），需要单独一条调用路径。",
        models: [
            {
                id: "claude-sonnet-4-5",
                label: "Claude Sonnet",
                tier: "均衡",
                note: "长文本与结构化输出稳，适合读方志、历志这类长材料。"
            },
            {
                id: "claude-opus-4-1",
                label: "Claude Opus",
                tier: "旗舰",
                note: "最强的推理与写作，贵。用在深度研究。"
            },
            {
                id: "claude-haiku-4-5",
                label: "Claude Haiku",
                tier: "快速",
                note: "最便宜最快，适合做检索前的意图判断。"
            }
        ]
    },
    {
        id: "gemini",
        label: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        keyHint: "AIza…",
        consoleUrl: "https://aistudio.google.com/apikey",
        consoleLabel: "aistudio.google.com",
        local: false,
        note: "有 OpenAI 兼容层，也可以走原生接口。上下文窗口很大。",
        models: [
            { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "旗舰", note: "超长上下文，适合整本书级别的材料。" },
            { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", tier: "快速", note: "便宜快，适合日常问答。" }
        ]
    },
    {
        id: "moonshot",
        label: "月之暗面 Kimi",
        baseUrl: "https://api.moonshot.cn/v1",
        keyHint: "sk-…",
        consoleUrl: "https://platform.moonshot.cn/console/api-keys",
        consoleLabel: "platform.moonshot.cn",
        local: false,
        note: "OpenAI 兼容。长文本是它的强项，中文史料处理合适。",
        models: [
            { id: "moonshot-v1-128k", label: "Moonshot 128k", tier: "长文", note: "128k 上下文，整卷方志可以一次读进去。" },
            { id: "kimi-k2-0905-preview", label: "Kimi K2", tier: "旗舰", note: "新一代旗舰，工具调用稳定。" }
        ]
    },
    {
        id: "zhipu",
        label: "智谱 GLM",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4",
        keyHint: "…",
        consoleUrl: "https://open.bigmodel.cn/usercenter/apikeys",
        consoleLabel: "open.bigmodel.cn",
        local: false,
        note: "OpenAI 兼容。有免费档模型，试水成本低。",
        models: [
            { id: "glm-4-plus", label: "GLM-4 Plus", tier: "旗舰", note: "综合能力最好的一档。" },
            { id: "glm-4-flash", label: "GLM-4 Flash", tier: "免费", note: "免费档，适合把设置跑通。" }
        ]
    },
    {
        id: "dashscope",
        label: "阿里通义千问",
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        keyHint: "sk-…",
        consoleUrl: "https://bailian.console.aliyun.com/",
        consoleLabel: "bailian.console.aliyun.com",
        local: false,
        note: "兼容模式走 OpenAI 形状，原生模式是 DashScope 自己的协议。",
        models: [
            { id: "qwen-max", label: "Qwen Max", tier: "旗舰", note: "通义最强的一档。" },
            { id: "qwen-plus", label: "Qwen Plus", tier: "均衡", note: "日常使用性价比高。" },
            { id: "qwen-turbo", label: "Qwen Turbo", tier: "快速", note: "最快最便宜。" }
        ]
    },
    {
        id: "siliconflow",
        label: "硅基流动",
        baseUrl: "https://api.siliconflow.cn/v1",
        keyHint: "sk-…",
        consoleUrl: "https://cloud.siliconflow.cn/account/ak",
        consoleLabel: "cloud.siliconflow.cn",
        local: false,
        note: "OpenAI 兼容的聚合站，一个密钥可以用到很多开源模型。",
        models: [
            { id: "deepseek-ai/DeepSeek-V3", label: "DeepSeek V3", tier: "均衡", note: "开源旗舰，走聚合站通常更便宜。" },
            { id: "Qwen/Qwen2.5-72B-Instruct", label: "Qwen2.5 72B", tier: "均衡", note: "中文好的开源大模型。" }
        ]
    },
    {
        id: "openrouter",
        label: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1",
        keyHint: "sk-or-…",
        consoleUrl: "https://openrouter.ai/settings/keys",
        consoleLabel: "openrouter.ai",
        local: false,
        note: "OpenAI 兼容的聚合网关，几乎覆盖所有主流模型，一个密钥走通。",
        models: [
            { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet", tier: "均衡", note: "经网关调用，省去逐家申请。" },
            { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", tier: "旗舰", note: "同上。" },
            { id: "deepseek/deepseek-r1", label: "DeepSeek R1", tier: "推理", note: "同上。" }
        ]
    },
    {
        id: "ollama",
        label: "Ollama（本地）",
        baseUrl: "http://127.0.0.1:11434/v1",
        keyHint: "本地不需要密钥",
        consoleUrl: "https://ollama.com/library",
        consoleLabel: "ollama.com/library",
        local: true,
        note: "本机推理，数据不出机器。首次使用要先 `ollama pull <模型>`。",
        models: [
            { id: "qwen2.5:14b", label: "Qwen2.5 14B", tier: "本地", note: "16GB 显存可跑，中文不错。" },
            { id: "llama3.1:8b", label: "Llama 3.1 8B", tier: "本地", note: "8GB 显存可跑，通用。" }
        ]
    },
    {
        id: "lmstudio",
        label: "LM Studio（本地）",
        baseUrl: "http://127.0.0.1:1234/v1",
        keyHint: "本地不需要密钥",
        consoleUrl: "https://lmstudio.ai/docs/local-server",
        consoleLabel: "lmstudio.ai",
        local: true,
        note: "图形界面的本地推理服务，OpenAI 兼容。适合不熟悉命令行的用户。",
        models: [
            { id: "local-model", label: "当前加载的模型", tier: "本地", note: "LM Studio 里选中的那个模型。" }
        ]
    }
];

/** `id` → 品牌。 */
export const AGENT_VENDOR_BY_ID: ReadonlyMap<string, AgentVendor> = new Map(
    AGENT_VENDORS.map((vendor) => [vendor.id, vendor])
);

/** 取一个品牌。 */
export const vendorOf = (id: string): AgentVendor | undefined => AGENT_VENDOR_BY_ID.get(id);

/**
 * 预设：一组"品牌 + 模型 + 参数"的命名组合。
 *
 * 界面让用户切的是**用途**而不是型号。理由在 `AgentSettingView` 的文件头：
 * 型号会过时，用途不会。这也是把十二个品牌、几十个型号压成四五个选项的办法——
 * 用户在对话页不该面对一张型号表。
 */
export interface AgentPreset {
    /** 标识 */
    id: string;
    /** 界面上的名字 */
    label: string;
    /** 什么时候用它 */
    useFor: string;
    /** 品牌 id */
    vendor: string;
    /** 模型 id */
    model: string;
    /** 温度 */
    temperature: number;
}

/** 预设表。 */
export const AGENT_PRESETS: readonly AgentPreset[] = [
    {
        id: "quick",
        label: "快速问答",
        useFor: "查一个日期、换一个历法、问一个术语",
        vendor: "deepseek",
        model: "deepseek-chat",
        temperature: 0.2
    },
    {
        id: "reason",
        label: "历算推演",
        useFor: "干支推演、闰月判断、跨历法换算这类要一步步算的",
        vendor: "deepseek",
        model: "deepseek-reasoner",
        temperature: 0.1
    },
    {
        id: "research",
        label: "深度研究",
        useFor: "读长材料、多来源比对、写出带引用的分析",
        vendor: "anthropic",
        model: "claude-sonnet-4-5",
        temperature: 0.4
    },
    {
        id: "writing",
        label: "长文写作",
        useFor: "把排盘结果或数据整理成一篇通顺的文章",
        vendor: "moonshot",
        model: "moonshot-v1-128k",
        temperature: 0.7
    },
    {
        id: "local",
        label: "离线私密",
        useFor: "不希望出生信息或命盘离开这台机器时",
        vendor: "ollama",
        model: "qwen2.5:14b",
        temperature: 0.3
    }
];

/** `id` → 预设。 */
export const AGENT_PRESET_BY_ID: ReadonlyMap<string, AgentPreset> = new Map(
    AGENT_PRESETS.map((preset) => [preset.id, preset])
);

/** 取一个预设。 */
export const presetOf = (id: string): AgentPreset | undefined => AGENT_PRESET_BY_ID.get(id);
