# 验证实现目录契约

本引用定义 `verification-implementation-review` 的 case 字段、派生索引、配置、CLI 和机器接口。触发边界、语义评估、写入授权和执行顺序由 [SKILL.md](../SKILL.md) 承接。

## 通用模型

默认目录路径是 `docs/verification/cases.md`，默认派生索引路径是 `docs/verification/verification-evidence-index.json`，默认配置路径是 `.verification-evidence.json`。

Markdown 目录是 case 的权威源；索引只保存可删除重建的查询投影和源定位。[SKILL.md](../SKILL.md) 定义“一个保留的独立验证入口对应一个 case”的语义规则，本文件只固定其目录表示和机器接口。

CLI 校验显式 case 并提供低上下文查询，不读取源码、不发现入口、不执行 `Entry:`、不自动登记 case，也不判断入口身份、父子归属、多个 locator 是否指向同一逻辑入口，或 `Contract:`、`Proves:` 的语义质量。

case 标题固定使用：

```markdown
### Case AUTH-ROLE-ACCESS-001: Access tests cover role outcomes
```

`Case` 是三级标题中的保留前缀。fenced code block 外，以 `Case` 开头的三级标题必须逐字采用 `### Case <CASE-ID>: <title>`；ID 是不含空白或冒号的单个 token，并符合 `caseIdPattern`；标题不能为空。其他标题保留为普通 Markdown 结构。

## Case 格式

每个 case 各有且只有一个 `Verification:`、`Entry:`、`Contract:` 和 `Proves:`：

1. `Verification: test | check` 表示实现类型。
2. `Entry:` 是至少一个非空列表项；每项使用一对反引号包裹同一逻辑入口的一个定义或调用定位信息。
3. `Contract:` 是至少一个非空文字列表项，说明该 case 需要长期固定的行为、边界或工程不变量。
4. `Proves:` 是至少一个非空文字列表项；每项说明当前契约语境下一个可独立判断的观察点。

目录只表示已经存在且决定保留的独立验证入口。入口准入和父子归属按 SKILL.md 判断；格式中不使用 `Status:`，也不表示 planned、review 或 exempt case。

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

`Entry:` 用于定位当前 case 对应的独立入口，可以保存：

1. 定义该独立入口的工作区相对文件或目录。
2. 项目拥有的 package script、task、规则 ID 或 CLI 调用入口。
3. 同一逻辑入口的多个定义位置或规范调用方式。

每项必须是一个非空反引号字符串；同一 case 内不得重复，且全部 locator 必须指向同一逻辑入口，不收纳内部辅助实现。目录校验不推断 locator 类型、不检查目标存在，也不执行命令。Agent 按 SKILL.md 确认 Entry 仍能定位真实入口、locator 归属一致，并确认本次范围内没有保留但未登记的独立入口。

### Contract 与 Proves

`Contract:` 提供证明背景，不记录 owner、代码路径、历史事故或实现细节。没有独立规范文档时，只有已经确认需要继续保持的当前行为才能写入；实现现状不能自动升级为长期契约。

`Proves:` 每项只写一个简短、直接且可判断的结果。它可以是行为分支、等价类、失败出口、状态迁移、工程规则、产物一致性或资源清理不变量。

同一独立入口的多个证明点保留在一个 case 中。case 的拆分与合并按 SKILL.md 的入口身份判断，不按 fixture、断言、规则、分支、执行阶段或 locator 数量机械处理；证明点数量与 Entry locator 数量不要求一一对应。

顺序、共享状态或分支关系仅靠列表难以恢复时，可以增加 fenced `mermaid` 图；图不替代 `Proves:`。

## 派生状态索引

目录通过领域适配接入通用状态索引。索引固定使用通用 `schemaVersion: 2`、`namespace: verification-evidence`、`definitionVersion: 2` 和 `"metadata": {}`。Markdown 始终是权威源；索引不拥有 case 写入或修复。

每个合法 case 产生一个查询 state：

1. case ID、标题和 `Verification`。
2. case 在当前目录中的起止行，用于 `show` 定点读取原始 Markdown。
3. `entries`，来自规范化后的 `Entry:` 列表。
4. `summary`，确定性取第一条 `Contract:`，不要求作者维护第二份摘要。
5. `searchText`，按 case ID、标题、全部 `Contract:`、全部 `Proves:` 和全部 `Entry:` 的顺序确定性拼接，仅用于生成搜索 key。

结构化的完整 `Contract:`、`Proves:`、Mermaid 和其他正文不进入 `list` 结果；`show` 继续从 Markdown 展开原文。重复 ID、非法字段、无效源范围或其他目录结构错误会阻止索引同步和内存投影。

索引声明两个领域查询 key：

1. `search`：使用 state 的 `searchText`，覆盖 case ID、标题、全部 Contract、全部 Proves 和全部 Entry。
2. `verification`：单值 exact key，合法值是 `test | check`。

保留的通用 `id` 查询直接使用 case ID。非空文本查询按空白拆词，所有词必须在同一 case 的 `search` key 中出现。`list` 默认最多返回 20 条并按 ID 排序；`show` 使用 reader get 定位一个 case。

`sourceRevision` 是对规范化目录文本、`catalogPath` 和 `caseIdPattern` 的 SHA-256 投影。上述输入变化后，旧索引必须判定为陈旧。`check` 和 `sync-index` 将索引缺失、损坏或陈旧视为阻断问题。

`list` 和 `show` 的索引读取遵循以下规则：

1. 优先使用当前持久化索引。
2. 索引缺失、陈旧、定义不匹配，或索引结构与 state 校验失败时，丢弃旧 state，从当前合法目录建立一次性内存投影，并返回非阻断 warning 提示运行 `sync-index --write`。
3. 索引路径非法、打开或读取失败、权限不足、源 revision 无法读取，以及目录自身无效或不可读时，查询失败且不附加同步建议。

内存投影不写文件。精确索引结构由 [verification-evidence-state-index.schema.json](schemas/verification-evidence-state-index.schema.json) 定义。

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

配置文件缺失且未显式传入 `--config` 时使用默认值。`catalogPath`、`indexPath` 和实际配置文件路径必须是互不相同的工作区相对文件身份：比较前统一路径分隔符并折叠 `.` 与重复分隔符；已存在目标按文件系统身份比较，尚未存在的目标在 Windows 和 macOS 上按常见的大小写不敏感语义比较。身份检查无法完成时配置无效；身份判断只用于拒绝冲突，不替换后续读写使用的工作区相对路径。`caseIdPattern` 必须是合法 JavaScript Unicode 正则。精确结构由 [verification-evidence-config.schema.json](schemas/verification-evidence-config.schema.json) 定义。

## CLI 与导入接口

```text
node scripts/verification-catalog.mjs check --root <workspace-root> [--config <config>] [--json]
node scripts/verification-catalog.mjs sync-index [--write] --root <workspace-root> [--config <config>] [--json]
node scripts/verification-catalog.mjs list --root <workspace-root> [--query <text>] [--verification <test|check>] [--limit <n>] [--offset <n>] [--json]
node scripts/verification-catalog.mjs show <case-id> --root <workspace-root> [--config <config>] [--json]
```

`check` 严格校验配置、目录和索引新鲜度；`sync-index` 默认只检查，增加 `--write` 才原子重建。`list` 和 `show` 的降级与阻断条件由[“派生状态索引”](#派生状态索引)统一定义。`show` 返回一个紧凑公开 state 和对应原始 Markdown。CLI 不执行 Entry 中的命令或文件。

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
