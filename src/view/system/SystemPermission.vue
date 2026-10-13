<script setup lang="ts">
/**
 * 权限与审计（`/system/permission`）：持久授权规则、默认策略与审计尾部。
 *
 * ## 这一页是"钩子"的可见面
 *
 * `docs/ui-architecture.md` §7.5 的理由：工作流会执行 `mutating` 动词
 * （写文件、改环境变量、操作窗口）。这些动作必须有**可查的授权面**——
 * HAX 的 **G17 提供全局控制** 与 **G16 传达后果** 都要求"授权不能只发生在一个
 * 一时的弹窗里"。
 *
 * 这一页不自己实现权限逻辑，它调用 `dsh-os` 已经做好的动词：
 *
 * | 动词                | 拿什么                                |
 * | ------------------- | ------------------------------------- |
 * | `selfcheck`         | 能力清单、动词数、ACL 是否启用及原因   |
 * | `permission.list`   | 已存规则、默认策略、文件是否可信       |
 * | `permission.audit`  | 追加式审计的尾部                      |
 *
 * ## 只读：这一页不写 `permission.json`
 *
 * 授权面**必须在界面上可查**，但**不该在这里随手改**。真正的授权动作发生在工作流
 * 运行到写操作、用户点"始终允许"的那一刻（那条路径会带上被授权的动词与目标）。
 * 在一个设置页里凭空造一条规则，等于绕过了"用户在具体后果面前点头"这个环节。
 *
 * 所以这一页只读；要撤销规则走 `permission.revoke`（将来在规则行上给按钮，
 * 但那也是一个"针对具体规则"的动作，不是凭空新建）。
 */

import { computed, onMounted, ref } from "vue";

import AppIcon from "../../component/AppIcon.vue";
import type { WorkflowEnvelope } from "../../../shared/workflow-api";

/** 一次动词调用的结果。 */
interface CallResult {
  ok: boolean;
  envelope: WorkflowEnvelope | null;
  stdout: string;
  stderr: string;
  note: string | null;
  command: string;
}

/** 调用一个只读动词。 */
const call = async (verb: string, args: string[] = []): Promise<CallResult> => {
  const result = await window.desktop.os.invoke({ verb, args });
  return {
    ok: result.ok,
    envelope: result.envelope,
    stdout: result.stdout,
    stderr: result.stderr,
    note: result.note,
    command: result.command
  };
};

/* -------------------------------------------------------------------------- */
/* selfcheck                                                                   */
/* -------------------------------------------------------------------------- */

interface SelfCheck {
  script?: string;
  powershell?: string;
  verbCount?: number;
  aclEnforced?: boolean;
  aclReason?: string;
  capabilities?: Record<string, unknown>;
}

const selfcheck = ref<SelfCheck | null>(null);
const selfcheckError = ref("");

/* -------------------------------------------------------------------------- */
/* permission.list                                                             */
/* -------------------------------------------------------------------------- */

interface PermissionRule {
  id?: string;
  verb?: string;
  target?: string;
  decision?: string;
  scope?: string;
  note?: string;
  at?: string;
}

const rules = ref<PermissionRule[]>([]);
const defaults = ref<Record<string, unknown> | null>(null);
const trusted = ref<boolean | null>(null);
const listError = ref("");

/* -------------------------------------------------------------------------- */
/* permission.audit                                                            */
/* -------------------------------------------------------------------------- */

interface AuditEntry {
  at?: string;
  verb?: string;
  target?: string;
  decision?: string;
  scope?: string;
  note?: string;
  actor?: string;
}

const audit = ref<AuditEntry[]>([]);
const auditError = ref("");

/* -------------------------------------------------------------------------- */
/* 取数                                                                        */
/* -------------------------------------------------------------------------- */

const busy = ref(false);

/**
 * `permission.list` 的信封形状在不同版本里可能不同（`rules` / `entries` / 顶层数组），
 * 所以这里**宽容地取**：先看 `result.rules`，再看 `result.entries`，最后看
 * `result` 本身是不是数组。取不到就是空——页面上会显示"没有规则"，
 * 而不会因为形状不符整页报错。
 */
const pickArray = <T,>(value: unknown, ...keys: string[]): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "object" && value !== null) {
    const bag = value as Record<string, unknown>;
    for (const key of keys) {
      if (Array.isArray(bag[key])) {
        return bag[key] as T[];
      }
    }
  }
  return [];
};

const load = async (): Promise<void> => {
  busy.value = true;
  selfcheckError.value = "";
  listError.value = "";
  auditError.value = "";

  const [check, list, log] = await Promise.all([
    call("selfcheck"),
    call("permission.list"),
    call("permission.audit", ["20"])
  ]);

  if (check.ok) {
    selfcheck.value = (check.envelope?.result ?? null) as SelfCheck | null;
  } else {
    selfcheckError.value = check.envelope?.error?.message ?? check.note ?? "selfcheck 没有返回信封";
  }

  if (list.ok) {
    const result = list.envelope?.result;
    rules.value = pickArray<PermissionRule>(result, "rules", "entries", "items");
    defaults.value =
      typeof result === "object" && result !== null
        ? ((result as Record<string, unknown>).defaults as Record<string, unknown> | undefined) ?? null
        : null;
    const trustedValue =
      typeof result === "object" && result !== null
        ? (result as Record<string, unknown>).trusted
        : undefined;
    trusted.value = typeof trustedValue === "boolean" ? trustedValue : null;
  } else {
    listError.value = list.envelope?.error?.message ?? list.note ?? "permission.list 没有返回信封";
  }

  if (log.ok) {
    audit.value = pickArray<AuditEntry>(log.envelope?.result, "entries", "tail", "rows");
  } else {
    auditError.value = log.envelope?.error?.message ?? log.note ?? "permission.audit 没有返回信封";
  }

  busy.value = false;
};

onMounted(load);

/** 能力清单：`capabilities` 的键值。 */
const capabilities = computed(() => {
  const bag = selfcheck.value?.capabilities;
  if (bag === undefined || bag === null) {
    return [];
  }
  return Object.entries(bag).map(([key, value]) => ({
    key,
    value: value === null ? "—" : String(value)
  }));
});

/** ACL 状态的一句话。 */
const aclText = computed(() => {
  const check = selfcheck.value;
  if (check === null) {
    return "未知";
  }
  if (check.aclEnforced === true) {
    return "已启用";
  }
  return `未启用（${check.aclReason ?? "原因未知"}）`;
});

/** 决策的中文与配色。两通道：文字 + 颜色（WCAG 1.4.1）。 */
const decisionTone = (decision: string | undefined): "success" | "danger" | "info" => {
  if (decision === "allow" || decision === "allow-always") {
    return "success";
  }
  if (decision === "deny" || decision === "deny-always") {
    return "danger";
  }
  return "info";
};
</script>

<template>
  <div class="permission">
    <!-- 环境：ACL 是否启用，以及为什么。这一条决定了授权到底走不走这个面 -->
    <div class="xy-panel permission__panel">
      <h2 class="xy-panel-title">授权环境</h2>

      <ElAlert
        v-if="selfcheckError.length > 0"
        type="warning"
        :closable="false"
        show-icon
        title="selfcheck 没跑通"
        :description="selfcheckError" />

      <ElDescriptions v-else :column="2" border size="small">
        <ElDescriptionsItem label="ACL">
          <ElTag :type="selfcheck?.aclEnforced ? 'success' : 'info'" size="small" effect="plain">
            {{ aclText }}
          </ElTag>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="动词数">
          <span class="numeral">{{ selfcheck?.verbCount ?? "—" }}</span>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="入口脚本">
          <span class="numeral">{{ selfcheck?.script ?? "—" }}</span>
        </ElDescriptionsItem>
        <ElDescriptionsItem label="解释器">
          <span class="numeral">{{ selfcheck?.powershell ?? "—" }}</span>
        </ElDescriptionsItem>
      </ElDescriptions>

      <ElDescriptions v-if="capabilities.length > 0" :column="2" border size="small" class="permission__caps">
        <ElDescriptionsItem v-for="item in capabilities" :key="item.key" :label="item.key">
          <span class="numeral">{{ item.value }}</span>
        </ElDescriptionsItem>
      </ElDescriptions>

      <div class="permission__actions">
        <ElButton :loading="busy" @click="load">
          <AppIcon name="Refresh" />
          <span>重新读取</span>
        </ElButton>
      </div>

      <p class="xy-note">
        这一段直接来自 <code>selfcheck</code> 动词——也就是说，界面上显示的能力与
        工作流执行时用到的是**同一份事实**，不是另抄一份说明。
        <code>aclEnforced</code> 为 false 时，写操作仍然要求 <code>--allow</code>，
        只是没有持久规则文件。
      </p>
    </div>

    <!-- 规则：持久授权 -->
    <div class="xy-panel permission__panel">
      <h2 class="xy-panel-title">持久授权规则</h2>

      <ElAlert
        v-if="listError.length > 0"
        type="info"
        :closable="false"
        show-icon
        title="读不到规则文件"
        :description="`${listError}。没有 permission.json 时这是正常的——它只在用户选过「始终允许」之后才会生成。`" />

      <ElEmpty
        v-else-if="rules.length === 0"
        description="还没有持久规则。工作流运行到写操作、你选「始终允许」之后，这里会出现一条。"
        :image-size="60" />

      <ElTable v-else :data="rules" stripe size="small">
        <ElTableColumn prop="verb" label="动词" width="180">
          <template #default="{ row }">
            <span class="numeral">{{ row.verb }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="target" label="目标" min-width="200">
          <template #default="{ row }">
            <span class="numeral permission__target">{{ row.target ?? "*" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="scope" label="范围" width="100" />
        <ElTableColumn label="决定" width="120">
          <template #default="{ row }">
            <!-- 不只靠颜色：标签本身带文字 -->
            <ElTag :type="decisionTone(row.decision)" size="small" effect="plain">
              {{ row.decision === "deny" || row.decision === "deny-always" ? "拒绝" : "允许" }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="note" label="备注" min-width="160" />
      </ElTable>

      <p class="xy-note">
        这一页**只读**。改授权只在工作流运行到写操作、你看到具体后果的那一刻发生
        ——在设置页里凭空造一条规则，等于绕过"用户在后果面前点头"这个环节。
      </p>
    </div>

    <!-- 审计：只追加的日志尾部 -->
    <div class="xy-panel permission__panel">
      <h2 class="xy-panel-title">审计（最近 20 条）</h2>

      <ElAlert
        v-if="auditError.length > 0"
        type="info"
        :closable="false"
        show-icon
        title="读不到审计日志"
        :description="auditError" />

      <ElEmpty v-else-if="audit.length === 0" description="审计日志还是空的" :image-size="60" />

      <ElTable v-else :data="audit" stripe size="small">
        <ElTableColumn prop="at" label="时间" width="180">
          <template #default="{ row }">
            <span class="numeral">{{ row.at ?? "—" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="verb" label="动词" width="180">
          <template #default="{ row }">
            <span class="numeral">{{ row.verb ?? "—" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="target" label="目标" min-width="200">
          <template #default="{ row }">
            <span class="numeral permission__target">{{ row.target ?? "—" }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="决定" width="120">
          <template #default="{ row }">
            <ElTag :type="decisionTone(row.decision)" size="small" effect="plain">
              {{ row.decision ?? "—" }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="note" label="备注" min-width="160" />
      </ElTable>

      <p class="xy-note">
        审计是**只追加**的：每一次授权决定都写进去，包括拒绝。
        这正是 HAX G17（全局控制）要的东西——用户能回看"谁在什么时候批准了什么"，
        而不是只有一个当下的弹窗。
      </p>
    </div>
  </div>
</template>

<style scoped>
.permission__panel {
  margin-bottom: 16px;
}

.permission__caps {
  margin-top: 12px;
}

.permission__actions {
  margin-top: 14px;
}

.permission__target {
  word-break: break-all;
}
</style>
