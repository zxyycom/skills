# 调查报告固定契约

本文件定义 `investigation-report` 的落盘结构、可选资源引用、派生索引和 CLI 语义。报告可以不引用资源；只有报告声明 `随附资源` 时才产生引用关系和对应的资源管理责任。何时保存形成时资源、怎样取得证据、哪些场景内容必须补足、何时追加或拆分以及如何判断内容质量，由 [SKILL.md](../SKILL.md) 承接。

## Owner 与目录

1. 每个主题 Markdown 是自身标题、核心问题、状态、最新报告时间和全部历史报告的唯一事实源，也是索引的基本单位。
2. `调查报告` 中每个三级标题是一份形成于特定时点的完整报告。报告是主题内部按形成时间追加的认识记录，不独立成为主索引条目；最后一份报告只表示最近记录，不自动成为累积当前口径。
3. 报告 Markdown 中可选的 `随附资源` 是“哪份报告以什么展示文字引用哪些资源”的唯一事实源。没有该字段的报告不拥有资源引用，索引不能为它补造关系。
4. 调查根目录下可选的 `_resources/` 是统一资源池；其中每个文件的原始字节是该资源内容的事实源。目录位置只定义资源 ID，不表达资源属于哪个主题。
5. `investigation-index.json` 是从当前调查根目录内全部主题 Markdown 和资源文件确定性生成的通用主题索引，只用于发现、过滤、排序、引用关系投影、资源完整性和新鲜度检查，不拥有独立事实。
6. `scripts/check-investigations.mjs` 的 `list` 命令通过通用 keys 查询已经核对新鲜度的索引，默认命令只读检查主题、资源和索引；只有显式 `sync-index` 命令可以创建或替换派生索引，不写主题或资源文件。
7. [investigation-index.schema.json](investigation-index.schema.json) 是随包分发的当前索引 JSON Schema；CLI 继续负责 Schema 无法证明的 Markdown 对应、资源安全、source revision、id、state、metadata 和 keys 一致性。

默认目录：

```text
docs/investigations/
├── investigation-index.json
├── _resources/                         # 可选；没有资源引用时不需要创建
│   └── <resource-id>                   # 可以包含多层目录
└── <category-id>/
    └── <semantic-slug>.md
```

`category-id` 只用于对主题文件做稳定分类，`semantic-slug` 标识分类内的主题文件；两者都使用英文小写、数字与连字符组成的 kebab-case。一个主题文件只承接一个稳定核心问题，路径创建后不因标题、状态或追加报告改变。除派生索引、可选的 `_resources/` 和一层 category 目录外，调查根目录不接受其他成员；category 目录只直接包含当前格式的主题 Markdown。`_resources/` 中的 Markdown 是资源，不参与主题发现。

可以用 `--investigations-dir` 选择工作区内的其他调查根目录，但同一集合始终使用同一根目录。首次创建主题时先建立主题文件，再运行 `sync-index` 创建索引；不能以空索引代替首份有效主题。

## 主题文件

主题文件首个非空行是唯一 H1，前两个 H2 依次固定为 `调查信息` 和 `调查报告`。不引用资源的报告使用以下完整基础结构：

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

### 完整报告与可选资源引用

1. `调查报告` 只出现一次且至少包含一个 H3。标题概括本轮认识、对象或复查目的，不使用“第一次”“继续调查”等无语义阶段名。
2. 每份报告首个非空内容固定为 `- 形成时间: <timestamp>`。`随附资源` 是可选字段；报告无需引用资源时，形成时间之后直接开始四个固定 H4，不创建 `随附资源`、占位列表或资源文件。
3. `随附资源` 字段存在时必须紧接 `形成时间` 且只出现一次，其嵌套无序列表必须至少包含一个本地 Markdown 链接：

   ```markdown
   ### 核对用户接口参数
   - 形成时间: 2026-08-06T16:00:00+08:00
   - 随附资源:
     - [接口参数原文](../_resources/api/get-user-parameters.md)
     - [原始响应样本](../_resources/api/get-user-response.json)

   #### 形成时背景
   ...
   ```

4. `随附资源` 嵌套无序列表的每个子项只包含一个无 title 的本地 Markdown 行内链接，链接展示文字按 Markdown AST 提取的文本投影必须非空；展示文字自身可以使用强调等行内标记，子项不能在链接之外包含文字、第二个链接或其他 Markdown 节点。
5. 链接目标必须在 Markdown 原文中逐字写为 `../_resources/<resource-id>`；不能用 Markdown 转义、字符引用或 `<...>` 包裹形成解析后等价的目标，也不能携带查询、片段、百分号编码或反斜杠。
6. 同一报告不能重复引用同一资源；同一资源可以被不同报告或主题共享。链接中的展示文字只保留在报告 Markdown，派生索引只保存规范化资源 ID。
7. 每份报告的前四个 H4 依次固定为 `形成时背景`、`调查目的`、`调查范围与依据` 和 `调查结果与边界`；各出现一次并包含实际内容，CLI 按这些精确标题校验。
8. 四项核心的内容语义、独立阅读要求、资源使用条件和人工审阅标准由 [SKILL.md](../SKILL.md) 承接。资源不能替代固定核心或正文中的关键事实。
9. 可选 H4 只能放在四个固定核心之后，不能替代固定核心。`调查报告` 之后可以增加附录、术语等 H2；它们也不替代完整报告。

## 资源池与资源 ID

1. 相对 `_resources/` 的规范化 POSIX 文件路径是资源 ID。资源可以平级或嵌套；目录层级只用于组织和身份，不声明主题归属。
2. 资源 ID 不能是绝对路径，不能包含空段、`.`、`..`、反斜杠、查询、片段或百分号编码。每个路径段只使用小写 ASCII 字母、数字、连字符、下划线和点，并以字母或数字开头和结尾。
3. 报告文件固定位于一层 category 目录，因此 `../_resources/<resource-id>` 必须按原文还原为唯一资源 ID；实际文件路径的大小写必须与 ID 完全一致。
4. 资源可以是文本或二进制普通文件。完整发现拒绝资源根、任一路径分量或文件本身为符号链接，也拒绝目录目标、其他非普通文件、缺失目标和越过调查根目录的路径。
5. `_resources/` 中每个普通文件都必须至少被一份报告声明引用；未引用文件是孤儿并使完整检查失败。这个规则管理资源池中的文件，不要求每份报告都引用资源。
6. 何时保存资源、正文怎样解释资源以及何时可以原地修改历史资源，由 [SKILL.md](../SKILL.md) 承接。本契约只校验已声明引用、资源文件、SHA-256 和 source revision 的结构与一致性；校验结果不判断资源来源可信、内容安全或历史修改正当性。
7. 文件系统校验面向受信任工作区中的静态状态和普通并发漂移。实现把实际打开的普通文件与 `_resources/` 规范根内路径身份绑定，并由同步写前的完整 source revision 复核拒绝读取期间变化；CLI 不充当隔离能够精确竞态系统调用的恶意主机进程的安全沙箱。

## JSON 通用索引

索引使用通用状态索引外壳，领域 namespace 为 `investigations`，当前 `definitionVersion` 为 `3`：

```json
{
  "definitionVersion": 3,
  "entries": {
    "codex/project-shell-mcp-registration.md": {
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
        "resourceReferences": [
          {
            "reportIndex": 1,
            "resourceIds": [
              "shell/registration-output.txt"
            ]
          }
        ],
        "status": "调查中",
        "title": "项目 Shell MCP 注册调查"
      }
    }
  },
  "keyDefinitions": [
    { "mode": "exact", "name": "category" },
    { "mode": "range", "name": "latest-report-at" },
    { "mode": "exact", "name": "status" },
    { "mode": "text", "name": "text" }
  ],
  "metadata": {
    "resources": [
      {
        "id": "shell/registration-output.txt",
        "sha256": "<64 lowercase hexadecimal characters>"
      }
    ]
  },
  "namespace": "investigations",
  "schemaVersion": 3,
  "sourceRevision": {
    "entries": {
      "codex/project-shell-mcp-registration.md": "sha256:<64 lowercase hexadecimal characters>"
    },
    "metadata": "sha256:<64 lowercase hexadecimal characters>"
  }
}
```

规则：

1. `entries` 是以主题 `id` 为成员键的对象，与合法主题 Markdown 一一对应；stored entry 只保存 `keys` 和 `state`，不重复保存 `id`。同一主题内无论包含多少份 H3 报告都只生成一个 entry，报告和资源都不拥有独立主索引 entry。
2. 相对调查根目录的主题路径同时作为 `entries` 成员键和 `state.path`，两者必须相等。路径在当前集合中唯一；移动主题会显式产生新 id，不从内容猜测重命名。`category-id` 只派生分类 key，不充当身份。
3. `state.title`、`state.question` 和 `state.reportTitles` 通过 Markdown AST 提取语义纯文本，去除行内标记并折叠空白；`reportTitles` 保持报告形成顺序，`reportCount` 必须等于其长度。状态和最新报告时间保存解析后的字段文本，state 不保存报告结果摘要、资源展示文字、Markdown 展示语法或正文副本。
4. 每个主题 state 必须包含 `resourceReferences`。它只投影声明了 `随附资源` 的报告；没有资源引用的主题保存空数组。`reportIndex` 是与 `reportTitles` 对应的零基报告序号，对象按 `reportIndex` 排序；每个对象的 `resourceIds` 彼此唯一并按 ID 排序。报告顺序变化会重建这些序号，序号不是跨版本持久身份。
5. `category` 和 `status` 是 exact key；`latest-report-at` 把最新报告时间转换为 epoch 毫秒后作为 range key；`text` 聚合主题标题、核心问题和全部报告标题。资源 ID、展示文字和资源正文都不进入查询 key；路径查询直接使用保留的主题 `id`。
6. `metadata.resources` 必须存在；没有资源的集合保存空数组。存在资源时按 ID 排序，每个被引用资源只保存一次规范化 ID 和原始字节的 SHA-256；`sha256` 是 64 个小写十六进制字符。领域校验要求 state 引用的每个资源 ID 在 metadata 中恰好出现一次，且 metadata 中没有未被 state 引用的资源。
7. `sourceRevision.entries` 与 `entries` 使用相同的主题 `id` 成员集。每个值只指纹化对应主题的 POSIX 路径和完整 Markdown UTF-8 文本，计算前只把 CRLF 规范化为 LF；单个主题内容变化只改变该主题的指纹，新增、删除或移动主题会改变成员集。
8. `sourceRevision.metadata` 稳定指纹化按 ID 排序的资源 ID 与原始字节 SHA-256；metadata 资源摘要和 metadata revision 来自同一次资源读取。资源新增、删除、重命名或内容变化都会改变集合级 revision。资源原始字节不做文本换行规范化。
9. 通用外壳固定使用 `schemaVersion: 3`。调查领域 `definitionVersion: 3`、`state.resourceReferences` 和 `metadata.resources` 是当前格式的必需部分；旧 definition version 或缺失这些字段的索引不兼容。
10. 输入发现顺序不影响确定性输出；key 定义、key 名和 key 值使用固定全序，metadata、state 和资源 ID 确定性排序，`reportTitles` 保持源顺序。JSON 使用两空格缩进、LF 和文件末尾换行，不保存生成时间。
11. 索引是可删除重建的派生副本。正常维护不直接编辑它，也不保留手写资源 manifest、`investigation-index.md` 或其他兼容索引；工具损坏时先恢复当前 CLI，再从主题 Markdown 和资源文件重建当前 JSON 格式。
12. `sync-index` 在同一次完整读取中解析报告引用、发现并校验资源、构建 state、metadata 和 source revision；写入前再次读取完整 revision。主题或资源在构建期间变化时拒绝替换索引。

## 时间与维护

1. `形成时间` 和 `最新报告时间` 使用带显式时区、无小数秒的 RFC 3339 时间戳。报告按形成时间非递减顺序追加。
2. 追加报告时写在 `调查报告` 容器末尾，并同步主题信息。原地修正或只更新状态时不新增报告，也不改变最新报告时间。
3. 主题文件不进入物理归档目录；状态、报告序列、形成时资源和 Git 历史共同表达演进。
4. 创建、更新、删除或移动主题文件，新增、修改、删除或移动资源，或改变资源引用后，都运行 `sync-index`；成功后再运行默认全量 `check`。同步失败不以手工修补 JSON 代替。
5. 移动或重命名资源会成为旧资源 ID 删除和新资源 ID 新增；必须同步更新所有引用该资源的报告，不能让索引或目录位置代替报告声明关系。

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

1. 检查调查根目录、分类目录、主题路径层级、kebab-case 文件名和保留的 `_resources/` 目录。
2. 检查主题文件 H1、前两个固定 H2、调查信息、状态和至少一份 H3 报告。
3. 检查每份报告的形成时间、可选 `随附资源` 的位置与精确结构、四个固定 H4 的存在、唯一、非空和顺序、报告时间顺序及最新报告时间一致性。
4. 发现完整资源池并拒绝非法 ID、路径大小写不一致、符号链接、非普通文件、缺失引用和孤儿资源，同时允许多个报告或主题共享同一资源。
5. 通过通用索引运行时完整解析来源并检查 JSON 外壳、主题 state、资源 metadata、id、keys、source revision、确定性内容、报告聚合字段、引用关系以及 Markdown、资源与索引的一致性。

带 `--category` 或 `--path` 的 `check` 只解析命中的主题，并校验这些报告声明的资源 ID 和资源文件；筛选没有命中时失败。局部结果不证明全局孤儿状态、metadata、source revision 或索引可查询。

`list` 先校验索引的通用结构、成员身份、namespace、definition version 和 key definitions，再发现当前主题与资源、读取资源原始字节并核对结构化 source revision。资源集合或内容导致索引陈旧时，诊断区分新增、删除和内容变化并定位资源 ID。这个快速路径不重新解析报告正文、不重建 state 或 keys，也不运行完整索引构建与领域深度校验。结果默认按 `latest-report-at` 倒序、相同时间按路径排序，并显示状态、最新报告时间、路径、主题标题、核心问题、报告数量和最新报告标题；没有命中不是错误。索引缺失、失效、定义不匹配或源在读取期间变化时失败，不返回可能过期的结果。

`sync-index` 不接受筛选。它先验证全部主题文件和资源，再确定性创建或替换 JSON 索引；任一主题或资源无效、根目录不可读、源在同步期间变化或写入验证失败时退出失败。

CLI 不判断章节语义、证据质量、资源是否值得保存、资源来源可信度、敏感信息、历史修改正当性、场景义务、状态选择或拆分判断；这些由 `SKILL.md` 的形成与审阅流程承接。退出状态 `0` 表示成功，`1` 表示结构、资源、索引或同步失败，`2` 表示参数错误。
