# 从 v2 组合接口升级

本指南适用于仍使用 `schemaVersion: 2` 的 `.test-evidence.json`、`test-evidence.mjs`、`validateTestEvidence`，或从 `errors`、`warnings` 读取机器诊断的项目。升级目标是让入口采集与账本维护分别依赖自己的 Schema，由调用方通过标准 `TestEntryInventory` 显式连接两层，并为账本生成当前通用状态索引。

当前分发不包含旧组合入口，也不在运行时转换旧配置或输出。配置、命令和调用代码应在同一次项目变更中完成升级。

已经完成两层拆分但仍使用账本配置 v3 的项目，只需增加 `indexPath`、把版本提升到 v4、运行一次 `sync-index --write`，并把机器输出版本更新为 v3；无需再次调整采集层。

## 1. 拆分配置

`.test-evidence.json` 只保留账本字段，并把版本改为 `4`：

```json
{
  "schemaVersion": 4,
  "catalogPath": "docs/testing/cases.md",
  "indexPath": "docs/testing/test-evidence-index.json",
  "caseIdPattern": "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$",
  "unregisteredTestEntries": "error",
  "reviewTriggers": "error",
  "reviewMaxAgeDays": 90
}
```

只有旧配置改变过发现范围或启用语言时，才新增 `.test-entry-regex.json`：

```json
{
  "schemaVersion": 1,
  "builtinDetectors": ["rust", "typescript", "python", "go"],
  "includeGlobs": ["src/**/*", "tests/**/*", "scripts/**/*"],
  "excludeGlobs": ["**/build/**", "**/vendor/**"],
  "patterns": []
}
```

字段按以下方式归位：

| v2 字段 | 当前 owner | 调整 |
| --- | --- | --- |
| `catalogPath`、`caseIdPattern`、`unregisteredTestEntries`、`reviewTriggers`、`reviewMaxAgeDays` | `.test-evidence.json` | 保留并使用账本配置 v4 |
| 无 | `.test-evidence.json` | 增加 `indexPath`，默认使用 `docs/testing/test-evidence-index.json` |
| `languages` | `.test-entry-regex.json` | 改名为 `builtinDetectors` |
| `includeGlobs` | `.test-entry-regex.json` | 原名保留 |
| `ignoreGlobs` | `.test-entry-regex.json` | 改名为 `excludeGlobs`；内置排除仍会自动保留 |

旧配置没有后三项或其值等同默认行为时，不创建采集配置。

## 2. 替换 CLI

原来的单命令检查：

```text
node scripts/test-evidence.mjs check --root <workspace-root> --json
```

先从合法账本生成派生索引，再把采集结果通过 stdin 传给账本层：

```text
node scripts/test-evidence-ledger.mjs sync-index --write --root <workspace-root>
node scripts/test-evidence-ledger.mjs list --query "<behavior or path>" --root <workspace-root>
node scripts/test-evidence-ledger.mjs show <case-id> --root <workspace-root>
node scripts/test-entry-regex.mjs --root <workspace-root> | node scripts/test-evidence-ledger.mjs check --inventory - --root <workspace-root> --json
```

`list` 和 `show` 直接查询当前索引，不接收清单；只有执行严格 `check` 或 inspection 时才显式触发采集，并按需把输出保存为临时 `inventory.json`。正则采集配置使用前一个命令的 `--config`，账本配置使用后一个命令的 `--config`。以后每次修改账本稳定 case 内容后重新运行 `sync-index --write`；入口清单不进入索引，review trigger 只在严格检查或显式 `list --triggered` 时动态计算。

## 3. 替换导入接口

把组合函数改为显式采集和账本调用：

```js
import { collectRegexTestEntries } from "./scripts/test-entry-regex.mjs";
import {
  syncTestEvidenceIndex,
  validateTestEvidenceLedger
} from "./scripts/test-evidence-ledger.mjs";

await syncTestEvidenceIndex({ mode: "write", workspaceRoot });
const inventory = await collectRegexTestEntries({ workspaceRoot });
const report = await validateTestEvidenceLedger({
  inventory,
  inventorySource: "regex collector",
  workspaceRoot
});
```

需要分页恢复紧凑 case 摘要时，直接调用不接收清单的 `queryTestEvidenceLedger`；需要按 ID 取得单条原始 Markdown 时调用 `showTestEvidenceCase`。入口映射和完整 source entry 视图由接收清单的 `inspectTestEvidenceLedger` 承接。自定义 AST、框架注册表或其他采集器可以直接替换严格检查和 inspection 的采集步骤，只要输出通过 `test-entry-inventory.schema.json` 校验。

## 4. 替换机器诊断读取

报告不再提供 `errors` 和 `warnings` 字符串数组。调用方直接读取 `diagnostics`：

```js
const commandFailed = report.diagnostics.some((item) => item.blocking);
const errors = report.diagnostics.filter((item) => item.severity === "error");
const warnings = report.diagnostics.filter((item) => item.severity === "warning");
```

`blocking` 决定当前命令是否完成，`severity` 表达问题本身的级别。显式 `list --triggered` 把正常 trigger 放在匹配 case 的 `trigger` 字段；只有 Git 或 Scope 计算边界和长期提醒保留为非阻断 diagnostic，因此不能用 error 数量代替命令完成判断。

## 5. 验收

1. `.test-evidence.json` 通过账本配置 v4 Schema；按需创建的 `.test-entry-regex.json` 通过采集配置 v1 Schema。
2. `sync-index --write` 生成通过 `test-evidence-state-index.schema.json` 的当前索引；无 `--write` 的同步检查返回成功。
3. 采集命令输出一个清单，账本 `check --inventory` 返回预期退出码和 `schemaVersion: 3` 报告。
4. 项目代码和自动化不再引用 `test-evidence.mjs`、`validateTestEvidence`、`inspectTestEvidence`、`runTestEvidenceCli`、`report.errors` 或 `report.warnings`。
5. `list` 和 `show` 不接收清单，并分别返回紧凑分页和单条原文；`check` 显式接收标准清单；`sync-index` 不接收清单；复杂采集器不需要修改账本模块。
