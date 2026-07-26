# 测试证据目录契约

本引用定义 `test-evidence-review` 的 case 字段、派生索引、配置、CLI 和机器接口。
触发边界、测试粒度、证据评估和执行顺序由 [SKILL.md](../SKILL.md) 承接。

## 通用模型

默认目录路径是 `docs/test-evidence/cases`，默认派生索引路径是
`docs/test-evidence/test-evidence-index.json`，默认配置路径是
`.test-evidence.json`。

`catalogPath` 指向主题目录。该目录直接子级中的每个 `*.md` 都是一个权威主题源，
必须至少包含一个 case；主题按稳定测试责任拆分，而不是把全部 case 集中进单个
Markdown。主题文件只提供维护与定位边界，case ID 仍是跨全部文件唯一的目录身份。
子目录和非 Markdown 文件不进入目录集合。

Markdown 主题文件共同组成权威源；索引只保存可删除重建的统一查询投影和源定位。
CLI 不读取测试源码、不发现测试、不执行 `Entry:`、不自动收集或注册 case，也不
判断多个 locator 是否属于同一最小原生测试入口。

case 标题固定使用：

```markdown
### Case AUTH-ROLE-ACCESS-001: Guest access is rejected
```

fenced code block 外，以 `Case` 开头的三级标题必须逐字采用
`### Case <CASE-ID>: <title>`。ID 是不含空白或冒号的单个 token，并符合
`caseIdPattern`；标题不能为空。

## Case 格式

每个 case 各有且只有一个 `Entry:`、`Contract:` 和 `Proves:`：

1. `Entry:` 至少包含一个非空列表项；每项用一对反引号包裹同一原生测试入口的
   定义或精确选择定位。
2. `Contract:` 至少包含一个非空文字列表项，说明测试所证明的稳定行为或边界。
3. `Proves:` 至少包含一个非空文字列表项，每项说明一个可观察结果。

目录不接受 `Verification:`、`Status:`、角色或 marker 字段。

```markdown
### Case AUTH-ROLE-ACCESS-001: Guest access is rejected

Entry:
- `tests/access.test.ts > rejects guest mutation`
- `bun test tests/access.test.ts --test-name-pattern "rejects guest mutation"`

Contract:
- Resource mutation follows the caller role boundary.

Proves:
- A guest mutation returns the forbidden result.
- The resource remains unchanged.
```

### Entry

`Entry:` 只定位一个最小原生测试入口，可以包含：

1. 测试文件与框架原生测试名称组成的稳定定位。
2. 能精确选择同一个原生测试节点的 runner 调用。
3. 同一节点在项目中已有的其他稳定标识。

只写文件、suite、目录、package script 或 CI job 通常只能定位容器，不能证明它们
本身就是 case。只有自定义测试程序确实只产生一个不可再归因、测试意图单一的最终
判定时，程序入口才可直接作为 case。

每项必须是一个非空反引号字符串；同一 case 内不得重复。目录校验不推断 locator
类型、不检查目标存在，也不执行命令；agent 按 SKILL.md 审查真实粒度。

### Contract 与 Proves

`Contract:` 提供测试所需背景，不记录历史事故、实现细节或目录 owner。没有独立
规范时，只有已经确认需要继续保持的当前行为才能写入。

`Proves:` 每项只写一个直接且可判断的可观察结果。同一个原生测试节点可以有多个
共同服务于单一测试意图的观察点；多个可独立命名、可独立失败的测试意图必须先拆成
不同测试节点，不能靠扩大 Proves 列表维持一个巨型 case。

## 派生状态索引

目录通过领域适配接入通用状态索引。索引固定使用通用 `schemaVersion: 2`、
`namespace: test-evidence`、`definitionVersion: 1` 和 `"metadata": {}`。

每个合法 case 产生一个查询 state：

1. case ID 和标题。
2. `sourcePath` 与 case 在该主题文件中的起止行。
3. `entries`，来自规范化后的 `Entry:` 列表。
4. `summary`，确定性取第一条 `Contract:`。
5. `searchText`，按 ID、标题、全部 Contract、全部 Proves 和全部 Entry 拼接，
   仅用于生成搜索 key。

结构化的完整 Contract、Proves 和其他正文不进入 `list` 结果；`show` 从 Markdown
展开原文。索引只声明一个领域 key：`search`。保留的通用 `id` 查询直接使用 case
ID。非空文本查询按空白拆词，所有词必须在同一 case 中出现；`list` 默认最多返回
20 条并按 ID 排序。

`sourceRevision` 是 `catalogPath`、`caseIdPattern` 以及按路径排序后的全部主题
路径与规范化正文的 SHA-256 投影。主题新增、删除、移动或正文变化后，旧索引都
必须判定为陈旧。

`list` 和 `show` 优先使用当前持久化索引。索引缺失、陈旧、定义不匹配或结构无效
时，从当前合法 Markdown 建立一次性内存投影，并返回非阻断 warning；索引路径、
源目录或权限本身不可用时查询失败。内存投影不写文件。

精确结构由 [test-evidence-state-index.schema.json](schemas/test-evidence-state-index.schema.json)
定义。

## 配置

配置固定使用 `schemaVersion: 2`：

```json
{
  "schemaVersion": 2,
  "catalogPath": "docs/test-evidence/cases",
  "indexPath": "docs/test-evidence/test-evidence-index.json",
  "caseIdPattern": "^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\\d{3}$"
}
```

配置缺失且未显式传入 `--config` 时使用默认值。`catalogPath` 是工作区相对目录；
`indexPath` 和实际配置路径是工作区相对文件。三者身份必须互不相同。路径会统一
分隔符并折叠 `.` 与重复分隔符；已有目标按文件系统身份比较，未存在目标在 Windows
和 macOS 上按常见大小写不敏感语义比较。身份检查失败时配置无效。

精确结构由 [test-evidence-config.schema.json](schemas/test-evidence-config.schema.json)
定义。

## CLI 与导入接口

```text
node scripts/test-evidence-catalog.mjs check --root <workspace-root> [--config <config>] [--json]
node scripts/test-evidence-catalog.mjs sync-index [--write] --root <workspace-root> [--config <config>] [--json]
node scripts/test-evidence-catalog.mjs list --root <workspace-root> [--query <text>] [--limit <n>] [--offset <n>] [--json]
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root> [--config <config>] [--json]
```

`check` 严格校验配置、全部主题文件、跨文件 case ID 唯一性和索引新鲜度；
`sync-index --write` 从完整主题集合原子重建统一索引。
CLI 不执行 Entry。

退出状态：

1. `0`：检查通过、同步成功或查询返回合法结果。
2. `1`：存在阻断诊断、索引未同步、目标缺失或执行失败。
3. `2`：参数错误。

使用 `--json` 时，可预期的配置、目录、索引和查询失败仍向 stdout 写当前命令
Schema，stderr 为空。报告、query、show 和同步结果使用 `schemaVersion: 2`；
调用方使用 `diagnostics[].blocking` 判断完成状态。

模块可安全导入且不会执行 CLI，导出：

1. `validateTestEvidence(options)`。
2. `syncTestEvidenceIndex(options)`。
3. `queryTestEvidence(options)`。
4. `showTestEvidenceCase(options)`。
5. 对应 Valibot Schema 和 `runTestEvidenceCatalogCli(argv)`。

相邻 `.d.mts` 提供公共声明；数据类型由 Valibot Schema 生成 JSON Schema，再生成
`*.types.d.mts`，不维护第二套结构真源。
