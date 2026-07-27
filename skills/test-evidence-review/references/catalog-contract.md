# 测试证据目录契约

本引用定义 `test-evidence-review` 的 topic、case、派生索引、CLI 和机器接口。
触发边界、测试粒度、证据评估和执行顺序由 [SKILL.md](../SKILL.md) 承接。

## 通用模型

测试证据根目录固定为 `docs/test-evidence`，派生索引固定为
`docs/test-evidence/test-evidence-index.json`。根目录中的
`test-evidence-topics.json` 是受控 topic 表；每个 case 单独位于
`<topic>/<slug>.md`。调用方只通过 `--root` 或 `workspaceRoot` 指定工作区，
不能改变目录、索引或 case ID 规则。

topic 只表达稳定的测试责任边界和查询维度，不改变 case 身份或测试粒度。一个保留的
最小原生测试入口仍恰好对应一个 case；case ID 在全部 topic 中唯一，移动 case 文件
不得修改其 ID。

Markdown case 文件共同组成权威源。索引只保存可删除重建的统一查询投影和源定位。
CLI 不读取测试源码、不发现测试、不执行 `Entry:`、不自动收集或注册 case，也不
判断多个 locator 是否属于同一最小原生测试入口。

## Topic 表与目录布局

`test-evidence-topics.json` 固定使用以下严格结构：

```json
{
  "schemaVersion": 1,
  "topics": [
    {
      "id": "access-control",
      "description": "Authorization boundaries and role-dependent outcomes."
    }
  ]
}
```

topic 表必须至少定义一个 topic，且不接受未知字段。每个 `id`：

1. 符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。
2. 在表内唯一。
3. 按二进制词法升序排列。

每个 `description` 必须已经 trim、只占一行，并包含 4 至 200 个 Unicode code
point。topic 表的 JSON 缩进或换行不参与 source revision；结构规范化后才进入投影。
精确结构由
[test-evidence-topic-catalog.schema.json](schemas/test-evidence-topic-catalog.schema.json)
定义。

测试证据根目录只允许：

1. 必需的 `test-evidence-topics.json`。
2. 派生的 `test-evidence-index.json`。
3. topic 表中定义的直属目录。

其他根文件、未知 topic 目录、符号链接或其他成员均使目录无效。每个 case 文件必须
是 topic 目录中的直属普通文件，文件名符合
`^[a-z0-9]+(?:-[a-z0-9]+)*\.md$`；嵌套目录、非 Markdown、符号链接和其他成员
均无效。

已定义 topic 可以没有 case，此时不创建对应目录。topic 目录一旦存在就必须至少
包含一个合法 case 文件，不能保留空目录。每个文件必须恰好包含一个 case。

`sourcePath` 固定为测试证据根目录相对路径 `<topic>/<slug>.md`，不包含
`catalogPath`。工具的构建、revision 读取和索引失效回退共同使用同一套根目录与
topic 扫描规则；非法布局不能通过只读回退绕过。

## Case 格式

case 标题固定使用：

```markdown
### Case AUTH-ROLE-ACCESS-001: Guest access is rejected
```

fenced code block 外，以 `Case` 开头的三级标题必须逐字采用
`### Case <CASE-ID>: <title>`。ID 是不含空白或冒号的单个 token，并固定符合
`^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+){2,}-\d{3}$`；标题不能为空。

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
`namespace: test-evidence` 和 `definitionVersion: 3`。`metadata.topics` 保存
规范化后的完整 topic 表。

每个合法 case 产生一个查询 state：

1. case ID 和标题。
2. 根目录相对 `sourcePath` 与 case 在文件中的起止行。
3. `entries`，来自规范化后的 `Entry:` 列表。
4. `summary`，确定性取第一条 `Contract:`。
5. `searchText`，按 ID、标题、全部 Contract、全部 Proves 和全部 Entry 拼接，
   仅用于生成搜索 key。

索引声明 `search` 和 `topic` 两个领域 key。`topic` 必须从 `sourcePath` 的第一段
派生，并同时存在于 `metadata.topics`；state 中不另存重复 topic 字段。解析持久化
索引时必须交叉校验 `sourcePath`、`keys.topic` 和 metadata，不能信任其中任一份
孤立数据。

结构化的完整 Contract、Proves 和其他正文不进入 `list` 结果；`show` 从 Markdown
展开原文。保留的通用 `id` 查询直接使用 case ID。非空文本查询按空白拆词，所有词
必须在同一 case 中出现；topic 查询使用精确 ID 匹配。`list` 默认最多返回 20 条并
按 ID 排序。

`sourceRevision` 由以下规范化输入计算：

1. topic 表的结构值。
2. 固定 case ID 规则。
3. 按根目录相对路径排序的全部 case `sourcePath` 与规范化正文。

topic 描述、case 新增、删除、移动或正文变化都会使旧索引陈旧。索引本身、topic
表 JSON 的纯格式变化和源文件换行风格不进入 revision。

`list` 和 `show` 优先使用当前持久化索引。索引缺失、陈旧、定义不匹配或结构无效
时，从当前完整合法目录建立一次性内存投影并返回非阻断 warning；topic 表、根目录
或任一 topic 成员无效时查询失败。内存投影不写文件。

精确结构由
[test-evidence-state-index.schema.json](schemas/test-evidence-state-index.schema.json)
定义。

## 固定路径与文件身份

工作区根目录是唯一位置参数。topic 表、派生索引和 case 文件都从固定目录直接
派生，不读取项目级配置，也不接受自定义路径或 case ID 正则。

索引与 topic 表及全部 case 必须拥有不同文件系统身份；已有目标会比较硬链接身份，
避免索引写入覆盖权威源。身份检查失败时目录无效。

## CLI 与导入接口

```text
node scripts/test-evidence-catalog.mjs topics --root <workspace-root> [--json]
node scripts/test-evidence-catalog.mjs check --root <workspace-root> [--json]
node scripts/test-evidence-catalog.mjs sync-index [--write] --root <workspace-root> [--json]
node scripts/test-evidence-catalog.mjs list --root <workspace-root> [--topic <topic>] [--query <text>] [--limit <n>] [--offset <n>] [--json]
node scripts/test-evidence-catalog.mjs show <case-id> --root <workspace-root> [--json]
```

`topics` 直接读取受控 topic 表，不依赖索引。`list --topic` 只接受一个已定义 topic；
已定义但没有 case 的 topic 返回合法空结果。未知 topic 返回结构化诊断并退出 `2`；
重复 `--topic` 属于参数错误并退出 `2`。

`check` 严格校验 topic 表、全部 case、跨 topic case ID 唯一性和索引新鲜度；
`sync-index --write` 从完整合法目录原子重建统一索引。CLI 不执行 Entry。

其他退出状态：

1. `0`：检查通过、同步成功或查询返回合法结果。
2. `1`：存在阻断诊断、索引未同步、目标缺失或执行失败。
3. `2`：参数错误或未知 topic。

使用 `--json` 时，可预期的目录、索引和查询失败仍向 stdout 写当前命令 Schema，
stderr 为空。report、query、show、topics 和同步结果使用
`schemaVersion: 4`；能够读取 topic 定义的结果都提供规范化 `topics` 数组，读取
失败时该数组为空。调用方使用 `diagnostics[].blocking` 判断完成状态。

模块可安全导入且不会执行 CLI，导出：

1. `listTestEvidenceTopics(options)`。
2. `validateTestEvidence(options)`。
3. `syncTestEvidenceIndex(options)`。
4. `queryTestEvidence(options)`。
5. `showTestEvidenceCase(options)`。
6. 对应 Valibot Schema 和 `runTestEvidenceCatalogCli(argv)`。

相邻 `.d.mts` 提供公共声明；数据类型由 Valibot Schema 生成 JSON Schema，再生成
`*.types.d.mts`，不维护第二套结构真源。
