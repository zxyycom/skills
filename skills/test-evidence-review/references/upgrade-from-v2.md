# 从 v2 组合接口升级

本指南适用于仍使用 `schemaVersion: 2` 的 `.test-evidence.json`、`test-evidence.mjs`、`validateTestEvidence`，或从 `errors`、`warnings` 读取机器诊断的项目。升级目标是让入口采集与账本维护分别依赖自己的 Schema，并由调用方通过标准 `TestEntryInventory` 显式连接两层。

当前分发不包含旧组合入口，也不在运行时转换旧配置或输出。配置、命令和调用代码应在同一次项目变更中完成升级。

## 1. 拆分配置

`.test-evidence.json` 只保留账本字段，并把版本改为 `3`：

```json
{
  "schemaVersion": 3,
  "catalogPath": "docs/testing/cases.md",
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
| `catalogPath`、`caseIdPattern`、`unregisteredTestEntries`、`reviewTriggers`、`reviewMaxAgeDays` | `.test-evidence.json` | 保留并使用账本配置 v3 |
| `languages` | `.test-entry-regex.json` | 改名为 `builtinDetectors` |
| `includeGlobs` | `.test-entry-regex.json` | 原名保留 |
| `ignoreGlobs` | `.test-entry-regex.json` | 改名为 `excludeGlobs`；内置排除仍会自动保留 |

旧配置没有后三项或其值等同默认行为时，不创建采集配置。

## 2. 替换 CLI

原来的单命令检查：

```text
node scripts/test-evidence.mjs check --root <workspace-root> --json
```

改为把采集结果通过 stdin 传给账本层：

```text
node scripts/test-entry-regex.mjs --root <workspace-root> | node scripts/test-evidence-ledger.mjs check --inventory - --root <workspace-root> --json
```

需要重复执行 `list`、`show` 和 `check` 时，可以先把采集输出保存为临时 `inventory.json`，再分别传给账本命令。正则采集配置使用前一个命令的 `--config`，账本配置使用后一个命令的 `--config`。

## 3. 替换导入接口

把组合函数改为显式采集和账本调用：

```js
import { collectRegexTestEntries } from "./scripts/test-entry-regex.mjs";
import { validateTestEvidenceLedger } from "./scripts/test-evidence-ledger.mjs";

const inventory = await collectRegexTestEntries({ workspaceRoot });
const report = await validateTestEvidenceLedger({
  inventory,
  inventorySource: "regex collector",
  workspaceRoot
});
```

需要查询 case 与入口映射时，使用相同清单调用 `inspectTestEvidenceLedger`。自定义 AST、框架注册表或其他采集器可以直接替换第一步，只要输出通过 `test-entry-inventory.schema.json` 校验。

## 4. 替换机器诊断读取

报告不再提供 `errors` 和 `warnings` 字符串数组。调用方直接读取 `diagnostics`：

```js
const commandFailed = report.diagnostics.some((item) => item.blocking);
const errors = report.diagnostics.filter((item) => item.severity === "error");
const warnings = report.diagnostics.filter((item) => item.severity === "warning");
```

`blocking` 决定当前命令是否完成，`severity` 表达问题本身的级别。查询可能把严格诊断复制为 `blocking: false`，因此不能用 error 数量代替命令完成判断。

## 5. 验收

1. `.test-evidence.json` 通过账本配置 v3 Schema；按需创建的 `.test-entry-regex.json` 通过采集配置 v1 Schema。
2. 采集命令输出一个清单，账本 `check --inventory` 返回预期退出码和 `schemaVersion: 2` 报告。
3. 项目代码和自动化不再引用 `test-evidence.mjs`、`validateTestEvidence`、`inspectTestEvidence`、`runTestEvidenceCli`、`report.errors` 或 `report.warnings`。
4. `list`、`show` 和 `check` 都显式接收同一格式的清单；复杂采集器不需要修改账本模块。
