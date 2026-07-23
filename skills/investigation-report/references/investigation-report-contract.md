# 调查报告固定契约

本文件只定义 `investigation-report` 的落盘结构、派生索引和 CLI 语义。何时调查、怎样取得证据、哪些场景内容必须补足、何时追加或拆分以及如何判断内容质量，由 [SKILL.md](../SKILL.md) 承接。

## Owner 与目录

1. 每个主题 Markdown 是自身标题、核心问题、状态、最新报告时间和全部历史报告的唯一事实源，也是索引的基本单位。
2. `调查报告` 中每个三级标题是一份形成于特定时点的完整报告。报告是主题内部按形成时间追加的认识记录，不独立成为主索引条目；最后一份报告只表示最近记录，不自动成为累积当前口径。
3. `investigation-index.json` 是从当前调查根目录内全部主题 Markdown 确定性生成的通用主题索引，只用于发现、过滤、排序和新鲜度检查，不拥有独立事实。
4. `scripts/check-investigations.mjs` 的 `list` 命令通过通用 keys 查询已经核对新鲜度的索引，默认命令只读检查主题文件和索引；只有显式 `sync-index` 命令可以创建或替换派生索引，不写主题文件。
5. [investigation-index.schema.json](investigation-index.schema.json) 是随包分发的当前索引 JSON Schema；CLI 继续负责 Schema 无法证明的 Markdown 对应、source revision、id 和 keys 一致性。

默认目录：

```text
docs/investigations/
├── investigation-index.json
└── <category-id>/
    └── <semantic-slug>.md
```

`category-id` 只用于对主题文件做稳定分类，`semantic-slug` 标识分类内的主题文件；两者都使用英文小写、数字与连字符组成的 kebab-case。一个主题文件只承接一个稳定核心问题，路径创建后不因标题、状态或追加报告改变。除派生 JSON 索引外，调查根目录内全部文件都必须是位于一层分类目录中的当前格式 Markdown。

可以用 `--investigations-dir` 选择工作区内的其他调查根目录，但同一集合始终使用同一根目录。首次创建主题时先建立主题文件，再运行 `sync-index` 创建索引；不能以空索引代替首份有效主题。

## JSON 通用索引

索引使用通用状态索引外壳，领域 namespace 为 `investigations`，当前 `definitionVersion` 为 `2`：

```json
{
  "definitionVersion": 2,
  "entries": [
    {
      "id": "codex/project-shell-mcp-registration.md",
      "keys": {
        "category": ["codex"],
        "latest-report-at": [1784613930000],
        "status": ["调查中"],
        "text": [
          "为什么项目 Shell MCP 没有注册到可用工具列表？",
          "复查当前注册状态",
          "恢复注册入口",
          "项目 Shell MCP 注册调查"
        ]
      },
      "state": {
        "latestReportAt": "2026-07-21T14:05:30+08:00",
        "path": "codex/project-shell-mcp-registration.md",
        "question": "为什么项目 Shell MCP 没有注册到可用工具列表？",
        "reportCount": 2,
        "reportTitles": [
          "恢复注册入口",
          "复查当前注册状态"
        ],
        "status": "调查中",
        "title": "项目 Shell MCP 注册调查"
      }
    }
  ],
  "keyDefinitions": [
    { "mode": "exact", "name": "category" },
    { "mode": "range", "name": "latest-report-at" },
    { "mode": "exact", "name": "status" },
    { "mode": "text", "name": "text" }
  ],
  "namespace": "investigations",
  "schemaVersion": 1,
  "sourceRevision": "sha256:<64 lowercase hexadecimal characters>"
}
```

规则：

1. `entries` 与合法主题 Markdown 一一对应；同一主题内无论包含多少份 H3 报告都只生成一个 entry，报告不拥有独立 `id`。
2. 相对调查根目录的主题路径同时作为 `id` 和 `state.path`。路径在当前集合中唯一；移动主题会显式产生新 id，不从内容猜测重命名。`category-id` 只派生分类 key，不充当身份。
3. `state.title`、`state.question` 和 `state.reportTitles` 通过 Markdown AST 提取语义纯文本，去除行内标记并折叠空白；`reportTitles` 保持报告形成顺序，`reportCount` 必须等于其长度。状态和最新报告时间保存解析后的字段文本，state 不保存报告结果摘要、Markdown 展示语法或正文副本。
4. `category` 和 `status` 是 exact key；`latest-report-at` 把最新报告时间转换为 epoch 毫秒后作为 range key；`text` 聚合主题标题、核心问题和全部报告标题。它不索引报告正文；需要正文级知识检索时应建立独立的报告读取侧，而不是改变主题主索引的粒度。路径查询直接使用保留的 `id`。
5. 索引覆盖调查根目录内全部合法主题文件，不维护手工成员清单，也不保留归档目录。新增和删除主题文件都通过下一次完整同步改变成员。
6. `sourceRevision` 对排序后的 POSIX 路径和完整 Markdown UTF-8 文本进行稳定 framing 后计算 SHA-256，计算前只把 CRLF 规范化为 LF。任何源内容或成员变化都会使旧索引失效，即使变化没有改变 state 投影。
7. 索引条目、key 定义、key 名和 key 值使用固定全序；state 对象键确定性排序，`reportTitles` 保持源顺序。JSON 使用两空格缩进、LF 和文件末尾换行，不保存生成时间。
8. 索引是可删除重建的派生副本。正常维护不直接编辑它，也不保留 `investigation-index.md` 或其他兼容索引；工具损坏时先恢复当前 CLI，再从主题 Markdown 重建当前 JSON 格式。
9. `sync-index` 从完整主题快照检查或原子替换索引，写入前再次读取 source revision；源在构建期间变化时拒绝写入。

## 主题文件

主题文件首个非空行是唯一 H1，前两个 H2 依次固定为 `调查信息` 和 `调查报告`：

```markdown
# <调查主题>

## 调查信息
- 核心问题: <本文件持续追踪的问题链>
- 状态: 调查中 | 暂停 | 已结束
- 最新报告时间: 2026-07-21T14:05:30+08:00

## 调查报告

### <本轮报告的语义标题>
- 形成时间: 2026-07-21T14:05:30+08:00

#### 形成时背景
<本轮调查形成时的上下文、触发认识、已知事实、假设、未知、约束和必要基线>

#### 调查目的
<本轮要回答的问题、支持的判断和预定边界>

#### 调查范围与依据
<实际检查的对象、来源、时点或版本、方法、实际覆盖范围，以及未检查或不能覆盖的内容>

#### 调查结果与边界
<本轮形成的事实、推断、建议、动作状态、未知、适用条件和复核条件>
```

四个固定 H4 之后允许增加 `时间线`、`证据`、`对照`、`状态模型`、`恢复` 或其他有语义名称的 H4；是否增加由 [SKILL.md](../SKILL.md) 的场景判断决定。

### 调查信息

1. 三个字段按示例顺序各出现一次，每个值是非空单行列表项，可以包含普通 Markdown 行内语法。
2. `核心问题` 定义文件身份，不能只是宽泛主题名称。
3. `状态` 只表示是否继续调查：`调查中` 表示仍在推进或值得继续，`暂停` 表示暂不推进，`已结束` 表示当前不再计划继续；它不承诺问题已解决。
4. `最新报告时间` 逐字等于最后一份报告的 `形成时间`。状态或纯编辑变化不改变它。
5. 顶部不保存背景、目的、范围、依据或当前结果摘要，避免形成第二份事实来源。

### 完整报告

1. `调查报告` 只出现一次且至少包含一个 H3。标题概括本轮认识、对象或复查目的，不使用“第一次”“继续调查”等无语义阶段名。
2. 每份报告首个非空内容固定为 `- 形成时间: <timestamp>`。
3. 每份报告的前四个 H4 依次固定为 `形成时背景`、`调查目的`、`调查范围与依据` 和 `调查结果与边界`；各出现一次并包含实际内容，CLI 按这些精确标题校验。
4. 四项核心的内容语义、独立阅读要求和人工审阅标准由 [SKILL.md](../SKILL.md) 承接。
5. 可选 H4 只能放在四个固定核心之后，不能替代固定核心。
6. `调查报告` 之后可以增加附录、术语等 H2；它们不替代完整报告。

## 时间与维护

1. `形成时间` 和 `最新报告时间` 使用带显式时区、无小数秒的 RFC 3339 时间戳。报告按形成时间非递减顺序追加。
2. 追加报告时写在 `调查报告` 容器末尾，并同步主题信息。原地修正或只更新状态时不新增报告，也不改变最新报告时间。
3. 主题文件不进入物理归档目录；状态、报告序列和 Git 历史共同表达演进。
4. 创建、更新、删除或移动主题文件后运行 `sync-index`；成功后再运行默认全量 `check`。同步失败不以手工修补 JSON 代替。

## CLI

从本 skill 目录运行，或使用 CLI 的实际安装路径：

```text
node <investigation-report-skill>/scripts/check-investigations.mjs --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs sync-index --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs list --root <workspace-root>
```

通用选项：

```text
--investigations-dir <path>  使用工作区内其他调查根目录
```

只读 `check` 和 `list` 都接受：

```text
--category <category-id>     筛选一个主题分类，可重复
--path <relative-path>       筛选一个主题路径，可重复
```

`list` 还接受：

```text
--status <调查中|暂停|已结束>  按状态筛选，可重复
--text <terms>                主题标题、核心问题或报告标题包含全部空白分隔词
--latest-from <timestamp>     最新报告时间不早于该时刻
--latest-to <timestamp>       最新报告时间不晚于该时刻
--limit <1..1000>             返回页大小，默认 50
--offset <non-negative-int>   返回页偏移，默认 0
```

无显式 command 时默认执行 `check`。`--path` 的值始终是相对调查根目录的主题文件路径；反斜杠会归一化为 POSIX 分隔符。重复参数取并集，同时使用多类筛选时取交集。

默认全量 `check`：

1. 检查调查根目录、分类目录、路径层级和 kebab-case 文件名。
2. 检查主题文件 H1、前两个固定 H2、调查信息、状态和至少一份 H3 报告。
3. 检查每份报告的形成时间、四个固定 H4 的存在、唯一、非空和顺序、报告时间顺序及最新报告时间一致性。
4. 通过通用索引运行时检查 JSON 外壳、主题 state、id、keys、source revision、确定性内容、报告聚合字段以及主题 Markdown 与索引一一对应。

带 `--category` 或 `--path` 的 `check` 只检查命中的主题文件结构，不检查全局索引新鲜度；筛选没有命中时失败。这个结果可用于隔离局部格式问题，但不能证明完整集合或索引已经可查询。

`list` 先读取持久化主题 state 和 keys、核对当前 source revision，再执行通用索引查询，不重新解析主题 Markdown 或报告正文。结果默认按 `latest-report-at` 倒序、相同时间按路径排序，并显示状态、最新报告时间、路径、主题标题、核心问题、报告数量和最新报告标题；没有命中不是错误。索引缺失、失效、定义不匹配或源在读取期间变化时失败，不返回可能过期的结果。

`sync-index` 不接受筛选。它先验证全部主题文件，再确定性创建或替换 JSON 索引；任一主题无效、根目录不可读、源在同步期间变化或写入验证失败时退出失败。

CLI 不判断章节语义、证据质量、场景义务、状态选择或拆分判断；这些由 `SKILL.md` 的形成与审阅流程承接。退出状态 `0` 表示成功，`1` 表示结构、索引或同步失败，`2` 表示参数错误。
