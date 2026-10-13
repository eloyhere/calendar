/**
 * 智能体状态 store：选中的品牌、模型、预设，以及"哪些品牌配了密钥"。
 *
 * ## 这里**只存"配没配"，不存密钥本身**
 *
 * 密钥由主进程用 `safeStorage` 加密保管（Windows 上走 DPAPI，绑定当前用户账户）。
 * 渲染进程从头到尾拿不到明文，所以本 store 里没有任何一处能读出密钥。
 * 这不是洁癖：渲染进程的代码、DOM、内存都可能被页面脚本读到，
 * 而密钥一旦泄露，代价是用户的账单。
 *
 * ## 为什么不用 `defineEntityStore`
 *
 * `src/store/store.ts` 的工厂是**读穿缓存**，它假设背后有一条
 * `service -> repository -> sqlite` 的链路、数据是构建期产物。
 * 界面偏好三样都不成立：它没有表、要立刻可写、换页必须保留。
 * 与 `chat.store.ts` / `shell.store.ts` 不用那个工厂是同一个理由。
 */

import { computed, ref } from "vue";
import { defineStore } from "pinia";

import type { AgentPreset } from "../entity/agent";
import { AGENT_PRESETS, AGENT_VENDORS, presetOf, vendorOf } from "../entity/agent";

/** 本地存储的键。只存偏好，**不存密钥**。 */
const STORAGE_KEY = "xy.agent.preference";

/** 落盘的偏好形状。 */
interface StoredPreference {
    vendor: string;
    model: string;
    preset: string;
}

/** 从本地存储读回偏好。读不出来就用登记表的第一条。 */
function loadPreference(): StoredPreference {
    const fallback: StoredPreference = {
        vendor: AGENT_VENDORS[0]?.id ?? "deepseek",
        model: AGENT_VENDORS[0]?.models[0]?.id ?? "deepseek-chat",
        preset: AGENT_PRESETS[0]?.id ?? "quick"
    };

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw === null) {
            return fallback;
        }
        const parsed = JSON.parse(raw) as Partial<StoredPreference>;
        const vendor = typeof parsed.vendor === "string" && vendorOf(parsed.vendor) !== undefined
            ? parsed.vendor
            : fallback.vendor;
        const models = vendorOf(vendor)?.models ?? [];
        const model = typeof parsed.model === "string" && models.some((item) => item.id === parsed.model)
            ? parsed.model
            : (models[0]?.id ?? fallback.model);
        const preset = typeof parsed.preset === "string" && presetOf(parsed.preset) !== undefined
            ? parsed.preset
            : fallback.preset;
        return { vendor, model, preset };
    } catch {
        // 本地存储被禁用或内容损坏：用默认值，不抛错——偏好读不出来不该让应用起不来
        return fallback;
    }
}

export const useAgentStore = defineStore("agent", () => {
    const initial = loadPreference();

    /** 当前品牌。 */
    const selectedVendor = ref(initial.vendor);

    /** 当前模型。 */
    const selectedModel = ref(initial.model);

    /** 当前预设。 */
    const selectedPreset = ref(initial.preset);

    /**
     * 已配密钥的品牌集合。
     *
     * 值只是 `true` / `false`，键是品牌 id。**没有密钥本身。**
     */
    const configured = ref<Set<string>>(new Set());

    /** 落盘。 */
    const persist = (): void => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    vendor: selectedVendor.value,
                    model: selectedModel.value,
                    preset: selectedPreset.value
                } satisfies StoredPreference)
            );
        } catch {
            // 存不进去（隐私模式、配额满）不影响本次会话，静默忽略
        }
    };

    /** 换品牌：同时把模型切到该品牌的第一条，避免"品牌是 A、模型是 B 家的"。 */
    const selectVendor = (id: string): void => {
        const vendor = vendorOf(id);
        if (vendor === undefined) {
            return;
        }
        selectedVendor.value = id;
        const first = vendor.models[0];
        if (first !== undefined) {
            selectedModel.value = first.id;
        }
        persist();
    };

    /** 换模型。 */
    const selectModel = (id: string): void => {
        selectedModel.value = id;
        persist();
    };

    /** 换预设：同时把品牌与模型一起换过去——预设本来就是"一组"的意思。 */
    const applyPreset = (preset: AgentPreset): void => {
        selectedPreset.value = preset.id;
        if (vendorOf(preset.vendor) !== undefined) {
            selectedVendor.value = preset.vendor;
        }
        selectedModel.value = preset.model;
        persist();
    };

    /** 按 id 换预设。 */
    const selectPreset = (id: string): void => {
        const preset = presetOf(id);
        if (preset !== undefined) {
            applyPreset(preset);
        }
    };

    /**
     * 记下"这个品牌配了密钥"。
     *
     * **值本身不经过这里**——调用方把密钥交给主进程之后，只回报一个布尔。
     */
    const markConfigured = (id: string, value: boolean): void => {
        const next = new Set(configured.value);
        if (value) {
            next.add(id);
        } else {
            next.delete(id);
        }
        configured.value = next;
    };

    /**
     * 保存密钥。
     *
     * 主进程的 IPC 通道尚未接通时**只有提示、不假装成功**：
     * 界面上"已配密钥"的绿标如果与真实情况不符，用户会带着一个空的密钥去提问，
     * 然后收到一个看不懂的鉴权错误。
     */
    const saveKey = async (id: string, value: string): Promise<boolean> => {
        const bridge = window.desktop as unknown as {
            agent?: { setKey?: (request: { vendor: string; key: string }) => Promise<boolean> };
        };
        const setKey = bridge.agent?.setKey;
        if (typeof setKey !== "function") {
            // 通道未接通：不写内存标记，让界面保持"未配"
            return false;
        }
        const ok = await setKey({ vendor: id, key: value });
        markConfigured(id, ok);
        return ok;
    };

    /** 撤销密钥。 */
    const clearKey = async (id: string): Promise<void> => {
        const bridge = window.desktop as unknown as {
            agent?: { clearKey?: (request: { vendor: string }) => Promise<void> };
        };
        await bridge.agent?.clearKey?.({ vendor: id });
        markConfigured(id, false);
    };

    /** 这个品牌配了密钥没有。 */
    const hasKey = (id: string): boolean => configured.value.has(id);

    /** 当前品牌 + 模型的一句话写法。 */
    const currentLabel = computed(() => {
        const vendor = vendorOf(selectedVendor.value);
        const model = vendor?.models.find((item) => item.id === selectedModel.value);
        return `${vendor?.label ?? selectedVendor.value} · ${model?.label ?? selectedModel.value}`;
    });

    return {
        selectedVendor,
        selectedModel,
        selectedPreset,
        configured,
        currentLabel,
        selectVendor,
        selectModel,
        selectPreset,
        applyPreset,
        markConfigured,
        saveKey,
        clearKey,
        hasKey
    };
});
