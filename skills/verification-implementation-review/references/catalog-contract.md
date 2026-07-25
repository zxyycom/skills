# 验证实现目录契约

本引用定义 `verification-implementation-review` 的 case 字段、派生索引、配置、CLI 和机器接口。触发边界、语义评估、写入授权和执行顺序由 [SKILL.md](../SKILL.md) 承接。

## 通用模型

默认目录路径是 `docs/verification/cases.md`，默认派生索引路径是 `docs/verification/verification-evidence-index.json`，默认配置路径是 `.verification-evidence.json`。

Markdown 目录是 case 的权威源；索引只保存可删除重建的紧凑投影和源定位。CLI 校验显式 case 并提供低上下文查询，不读取源码、不发现入口、不执行 `Entry:`、不自动登记 case，也不判断 `Contract:` 或 `Proves:` 的语义质量。

case 标题固定使用：

```markdown
### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes
```

`Case` 是三级标题中的保留前缀。fenced code block 外，以 `Case` 开头的三级标题必须逐字采用 `### Case <CASE-ID>: <title>`；ID 是不含空白或冒号的单个 token，并符合 `caseIdPattern`；标题不能为空。其他标题保留为普通 Markdown 结构。

## Case 格式

每个 case 各有且只有一个 `Verification:`、`Entry:`、`Contract:` 和 `Proves:`：

1. `Verification: test | check` 表示实现类型。
2. `Entry:` 是至少一个非空列表项；每项使用一对反引号包裹一个实现定位信息。
3. `Contract:` 是至少一个非空文字列表项，说明该 case 需要长期固定的行为、边界或工程不变量。
4. `Proves:` 是至少一个非空文字列表项；每项说明当前契约语境下一个可独立判断的观察点。

目录只登记已经存在并决定保留的验证实现，不使用 `Status:`，也不登记 planned、review 或 exempt case。

### Test case

```markdown
### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes
Verification: test

Entry:
- `tests/access.test.ts`
- `bun test tests/access.test.ts`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- Owners can edit.
- Guests are denied.
```

### Check case

```markdown
### Case SCHEMA-GENERATED-CURRENT-001: Generated schema stays current
Verification: check

Entry:
- `scripts/check-generated.ts`
- `bun run check:generated`

Contract:
- Committed schema artifacts match their maintained source.

Proves:
- Regeneration produces no artifact drift.
```

### Entry

`Entry:` 用于定位实现，可以保存：

1. 工作区相对文件或目录。
2. 项目拥有的 package script、task、规则 ID 或 CLI 调用入口。
3. 同一 case 的多个实现位置或规范调用入口。

每项必须是一个非空反引号字符串；同一 case 内不得重复。目录校验不推断 locator 类型、不检查目标存在，也不执行命令。Agent 在语义审查和项目验证中确认 Entry 仍能定位真实实现。

### Contract 与 Proves

`Contract:` 提供证明背景，不记录 owner、代码路径、历史事故或实现细节。没有独立规范文档时，只有已经确认需要继续保持的当前行为才能写入；实现现状不能自动升级为长期契约。

`Proves:` 每项只写一个简短、直接且可判断的结果。它可以是行为分支、等价类、失败出口、状态迁移、工程规则、产物一致性或资源清理不变量。

多个证明点共享 fixture、输入集合、规则上下文、执行主干或连续链路，且拆分会复制准备、丢失顺序关系或增加维护成本时，保留在同一 case。形成独立契约、Entry、运行环境或维护周期时建立独立 case。证明点数量与 Entry 数量不要求一一对应。

顺序、共享状态或分支关系仅靠列表难以恢复时，可以增加 fenced `mermaid` 图；图不替代 `Proves:`。

## 派生状态索引

目录通过领域适配接入通用状态索引。索引固定使用通用 `schemaVersion: 2`、`namespace: verification-evidence`、`definitionVersion: 1` 和 `"metadata": {}`。Markdown 始终是权威源；索引不拥有 case 写入或修复。

每个合法 case 产生一个紧凑 state：

1. case ID、标题和 `Verification`。
2. case 在当前目录中的起止行，用于 `show` 定点读取原始 Markdown。
3. `entries`，来自规范化后的 `Entry:` 列表。
4. `summary`，确定性取第一条 `Contract:`，不要求作者维护第二份摘要。

完整 `Contract:`、`Proves:`、Mermaid 和其他正文不进入索引或 `list` 结果。重复 ID、非法字段、无效源范围或其他目录结构错误会阻止索引同步。

索引声明两个领域查询 key：

1. `search`：case ID、标题、首条契约摘要和全部 Entry 的确定性拼接文本。
2. `verification`：单值 exact key，合法值是 `test | check`。

保留的通用 `id` 查询直接使用 case ID。非空文本查询按空白拆词，所有词必须在同一 case 的 `search` key 中出现。`list` 默认最多返回 20 条并按 ID 排序；`show` 使用 reader get 定位一个 case。

`sourceRevision` 是对规范化目录文本、`catalogPath` 和 `caseIdPattern` 的 SHA-256 投影。上述输入变化后，旧索引必须判定为陈旧。索引缺失、损坏或陈旧时查询明确失败并提示重建，不回退为每次解析整份目录，也不静默使用旧 state。精确结构由 [verification-evidence-state-index.schema.json](schemas/verification-evidence-state-index.schema.json) 定义。

## 配置

配置固定使用 `schemaVersion: 1`：

```json
{
  "schemaVersion": 1,
  "catalogPath": "docs/verification/cases.md",
  "indexPath": "docs/verification/verification-evidence-index.json",
  "caseIdPattern": "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
}
```

配置文件缺失且未显式传入 `--config` 时使用默认值。三个路径必须是互不相同的工作区相对路径；`caseIdPattern` 必须是合法 JavaScript Unicode 正则。精确结构由 [verification-evidence-config.schema.json](schemas/verification-evidence-config.schema.json) 定义。

## CLI 与导入接口

```text
node scripts/verification-catalog.mjs check --root <workspace-root> [--config <config>] [--json]
node scripts/verification-catalog.mjs sync-index [--write] --root <workspace-root> [--config <config>] [--json]
node scripts/verification-catalog.mjs list --root <workspace-root> [--query <text>] [--verification <test|check>] [--limit <n>] [--offset <n>] [--json]
node scripts/verification-catalog.mjs show <case-id> --root <workspace-root> [--config <config>] [--json]
```

`check` 严格校验配置、目录和索引新鲜度；`sync-index` 默认只检查，增加 `--write` 才原子重建；`list` 只查询当前索引；`show` 返回一个紧凑 state 和对应原始 Markdown。CLI 不执行 Entry 中的命令或文件。

退出状态：

1. `0`：检查通过、索引同步成功或查询返回合法结果。
2. `1`：存在阻断诊断、索引未同步、查询目标缺失或执行失败。
3. `2`：参数错误。

指定 `--json` 时，可预期的配置、目录、索引和查询失败仍向 stdout 写当前命令对应 Schema，stderr 保持为空；参数语法错误继续由帮助文本和退出状态 `2` 承接。

报告、query、show 和索引同步结果固定使用 `schemaVersion: 1`。每项 diagnostic 至少包含 `blocking`、稳定 `code`、`category`、`severity` 和 `message`，按可用信息增加 `path`、`line`、`column` 或 `caseId`。调用方使用 `diagnostics[].blocking` 判断完成状态。

模块可以安全导入且不会执行 CLI，导出：

1. `validateVerificationEvidence(options)`。
2. `syncVerificationEvidenceIndex(options)`。
3. `queryVerificationEvidence(options)`。
4. `showVerificationCase(options)`。
5. 上述数据的 Valibot Schema 和 `runVerificationCatalogCli(argv)`。

相邻 `.d.mts` 提供公共函数声明；数据类型由同一 Valibot Schema 生成 JSON Schema，再生成 `*.types.d.mts`，不维护第二套结构真源。
