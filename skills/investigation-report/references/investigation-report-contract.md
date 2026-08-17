# 调查报告固定契约

本文件定义 `investigation-report` 的落盘结构、可选资源引用、派生索引和 CLI 语义。报告可以不引用资源；只有报告声明 `随附资源` 时才产生引用关系和对应的资源管理责任。何时保存形成时资源、怎样取得证据、哪些场景内容必须补足、何时追加或拆分以及如何判断内容质量，由 [SKILL.md](../SKILL.md) 承接。

## Owner 与目录

1. 每个主题 Markdown 是自身标题、核心问题、状态、最新报告时间和全部历史报告的唯一事实源，也是索引的基本单位。
2. `调查报告` 中每个三级标题是一份形成于特定时点的完整报告。报告是主题内部按形成时间追加的认识记录，不独立成为主索引条目；最后一份报告只表示最近记录，不自动成为累积当前口径。
3. 报告 Markdown 中可选的 `随附资源` 是“哪份报告以什么展示文字引用哪些资源”的唯一事实源。没有该字段的报告不拥有资源引用，索引不能为它补造关系。
4. 调查根目录下可选的 `_resources/` 是统一资源池；资源 ID 固定为 `<category-id>/<semantic-slug>/<resource-subpath>`，映射 owner topic `<category-id>/<semantic-slug>.md`。其中 `resource-subpath` 至少包含一个文件名，owner 根之后可以合法嵌套；这个路径是资源唯一 owner 的事实来源，不限制其他主题引用。每个受管文件的原始字节是资源内容的事实源。Git 工作区以版本控制可见文件界定受管成员，非 Git 工作区以文件系统完整发现界定受管成员。
5. `investigation-index.json` 是从当前调查根目录内全部主题 Markdown 确定性生成的通用主题索引，只用于发现、过滤、排序和报告资源关系投影，不拥有独立事实。当前资源完整性由 `check` 与 `sync-index` 的前置全量校验承接，资源成员、路径和字节不进入索引来源或新鲜度。
6. `scripts/check-investigations.mjs` 的 `check` 命令只读检查主题、当前资源和索引，`sync-index` 先完成默认全量资源校验再创建或替换工作树中的派生索引，`list` 通过通用 keys 查询已经核对主题 Markdown 新鲜度的索引且不读取资源池；`stage-index` 可以按主题 ID 对该索引执行受控的版本仓库 `pending` 写入。命令都不写主题或资源文件。
7. [investigation-index.schema.json](investigation-index.schema.json) 是随包分发的当前索引 JSON Schema；CLI 继续负责 Schema 无法证明的 Markdown 对应、资源安全、完整全量资源检查、source revision、id、state、metadata 和 keys 一致性。

本文中的“工作区索引”指工作树内当前的 `investigation-index.json`；`pending` 指版本管理暂存区中的待提交内容。两者是同一路径在不同版本管理状态下的内容，不能互相替代。

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
    - [接口参数原文](../_resources/api/get-user-parameters/parameters.md)
    - [原始响应样本](../_resources/api/get-user-parameters/response.json)

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

1. 相对 `_resources/` 的规范化 POSIX 文件路径是资源 ID，固定为 `<category-id>/<semantic-slug>/<resource-subpath>`。前两段必须逐字对应唯一 owner topic `<category-id>/<semantic-slug>.md`；`resource-subpath` 至少包含一个文件名，之后可以任意合法嵌套。资源 owner 不限制其他报告或主题引用同一文件。
2. 资源 ID 不能是绝对路径，不能包含空段、`.`、`..`、反斜杠、查询、片段或百分号编码。正斜杠只分隔路径段，不属于路径段字符。
3. 资源 ID 的每个路径段只允许以下字符：
   - 身份字符：常用汉字 `U+4E00..U+9FFF`、汉字数字零 `〇`、大小写 ASCII 英文字母和 ASCII 数字。
   - 基础符号：`.`、`_`、`-`、`+`、`@`、`=`。
   - 括号与书名号：`(`、`)`、`（`、`）`、`[`、`]`、`【`、`】`、`《`、`》`。
   - 标点：`,`、`!`、`~`、`'`、`，`、`。`、`！`、`、`、`·`、`：`、`？`。
   白名单之外的字符均不合法；例如 ASCII 问号 `?` 不因全角问号 `？` 已放行而合法，其他字符也不因属于 Unicode 字母、数字、标点或可打印字符而自动合法。
4. 每个资源 ID 路径段必须满足以下结构门禁：不能以 `.` 开头或结尾；至少包含一个身份字符；不能使用不区分大小写的 Windows 保留设备名 `CON`、`PRN`、`AUX`、`NUL`、`COM1..9` 或 `LPT1..9` 及其带扩展名形式；ASCII 圆括号必须成对，允许空内容和嵌套，最大嵌套深度为 32。
5. `category-id` 与 `semantic-slug` 都使用主题文件相同的 kebab-case；报告文件固定位于一层 category 目录，因此 `../_resources/<resource-id>` 必须按原文还原为唯一资源 ID；实际文件路径的大小写必须与 ID 完全一致。
6. 资源可以是文本或二进制普通文件。被引用资源不接受资源根、任一路径分量或文件本身为符号链接，也不接受目录目标、其他非普通文件、缺失目标和越过调查根目录的路径；完全未引用的可见资源适用第 7 条的 warning 严重性。
7. Git 工作区只把 `git ls-files --cached --others --exclude-standard` 在 `_resources/` 范围内返回的文件作为版本控制可见资源：项目 `.gitignore`、仓库 exclude 和全局 exclude 排除的未跟踪文件不产生 warning，已经跟踪或通过 `git add -f` 进入 pending 的文件即使命中 ignore 仍可见。非 Git 工作区继续完整发现 `_resources/` 中的文件系统资源。默认全量检查先收集全部合法主题报告的引用，再发现可见成员：被引用资源必须满足 owner 前缀、owner 主题存在且至少一份 owner 报告引用，并继续严格校验路径安全、精确大小写、存在性、普通文件身份和版本控制可见性；报告显式引用因 ignore 被排除的未跟踪文件时必须失败。只要能够确定可见成员完全未被引用，它及其非法 owner 结构、缺失 owner 主题、非法类型或安全路径问题都只产生 warning；一旦报告引用该路径，相应问题是 error。已存在资源根无法安全解析或读取、版本控制查询失败等使成员或引用集合无法可靠建立时，是资源检查无法完成的 error，不归因于某个未引用资源。
8. 何时保存资源、正文怎样解释资源以及何时可以原地修改历史资源，由 [SKILL.md](../SKILL.md) 承接。本契约只校验已声明引用和资源文件的结构、归属与当前完整性；校验结果不判断资源来源可信、内容安全或历史修改正当性。
9. 文件系统校验面向受信任工作区中的静态状态和普通并发漂移。实现把实际打开的普通文件与 `_resources/` 规范根内路径身份绑定。`sync-index` 写入前只复核由主题 Markdown 构成的 source revision：资源在此前完整资源检查完成后改变，不会使 `definitionVersion: 5` 的索引写入视为 source drift；要核对改变后的资源状态，随后运行默认全量 `check`。CLI 不充当隔离能够精确竞态系统调用的恶意主机进程的安全沙箱。

## JSON 通用索引

索引使用通用状态索引外壳，领域 namespace 为 `investigations`，当前 `definitionVersion` 为 `5`：

```json
{
  "definitionVersion": 5,
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
              "codex/project-shell-mcp-registration/registration-output.txt"
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
  "metadata": {},
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
6. `metadata` 必须是拒绝额外字段的严格空对象。资源 ID、SHA-256、引用计数、资源状态和资源内容摘要都不进入 metadata；领域校验从报告 Markdown 投影 `resourceReferences`，不通过 metadata 校验引用、未引用资源或资源内容。
7. `sourceRevision.entries` 与 `entries` 使用相同的主题 `id` 成员集。每个值只指纹化对应主题的 POSIX 路径和完整 Markdown UTF-8 文本，计算前只把 CRLF 规范化为 LF；单个主题内容变化只改变该主题的指纹，新增、删除或移动主题会改变成员集。
8. `sourceRevision.metadata` 只稳定指纹化严格空 metadata；不读取、枚举或摘要 `_resources/`。资源成员、路径名称和原始字节不参与 source revision，也不决定 `list` 的索引新鲜度。
9. 通用外壳固定使用 `schemaVersion: 3`。调查领域 `definitionVersion: 5`、`state.resourceReferences` 和严格空 `metadata` 是当前格式的必需部分；旧 definition version 或缺失这些字段的索引不兼容。
10. 输入发现顺序不影响确定性输出；key 定义、key 名和 key 值使用固定全序，state 和每个 `resourceIds` 确定性排序，`reportTitles` 保持源顺序。JSON 使用两空格缩进、LF 和文件末尾换行，不保存生成时间。
11. 索引是可删除重建的派生副本。正常维护不直接编辑它，也不保留手写资源 manifest、`investigation-index.md` 或其他兼容索引；工具损坏时先恢复当前 CLI，再从主题 Markdown 重建当前 JSON 格式。
12. `sync-index` 先完成完整资源检查，再只由主题 Markdown 构建 state、严格空 metadata 和 source revision；写入前再次读取主题 Markdown revision。主题在构建期间变化时拒绝替换索引，资源在资源校验完成后的变化不构成索引并发漂移。

## 时间与维护

1. `形成时间` 和 `最新报告时间` 使用带显式时区、无小数秒的 RFC 3339 时间戳。报告按形成时间非递减顺序追加。
2. 追加报告时写在 `调查报告` 容器末尾，并同步主题信息。原地修正或只更新状态时不新增报告，也不改变最新报告时间。
3. 主题文件不进入物理归档目录；状态、报告序列、形成时资源和 Git 历史共同表达演进。
4. 创建、更新、删除或移动主题文件，或改变资源引用后，都运行 `sync-index`；成功后再运行默认全量 `check`。仅新增、修改、删除或移动资源时，运行默认全量 `check`，不以资源变化重建索引。同步失败不以手工修补 JSON 代替。
5. 移动或重命名资源会成为旧资源 ID 删除和新资源 ID 新增；必须同步更新所有引用该资源的报告，不能让索引或目录位置代替报告声明关系。

## CLI

从本 skill 目录运行，或使用 CLI 的实际安装路径：

```text
node <investigation-report-skill>/scripts/check-investigations.mjs --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs sync-index --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs list --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs stage-index <topic-id...> --root <workspace-root>
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
4. 收集全量主题引用并发现完整版本控制可见资源池。被引用资源的非法 ID 或 owner、缺失 owner 引用、路径大小写不一致、符号链接、非普通文件、缺失目标或被忽略的显式引用都是 errors；能够确定完全未引用的可见资源及其同类问题都是 warnings。资源根不可读或 Git 查询失败等无法完成资源检查的操作问题是 errors。
5. 通过通用索引运行时完整解析来源并检查 JSON 外壳、主题 state、严格空 metadata、id、keys、source revision、确定性内容、报告聚合字段、引用关系以及 Markdown 与索引的一致性。

带 `--category` 或 `--path` 的 scoped `check` 只解析命中的主题，并校验这些报告声明的资源 ID 和直接目标文件；筛选没有命中时失败。它不额外读取未命中的 owner 主题，因此不证明跨主题 owner anchor、全局未引用资源状态、metadata、source revision 或索引可查询。

`list` 先校验索引的通用结构、成员身份、namespace、definition version 和 key definitions，再发现当前主题并核对结构化 source revision。它不读取、枚举或校验资源池。这个快速路径不重新解析报告正文、不重建 state 或 keys，也不运行完整索引构建与领域深度校验。结果默认按 `latest-report-at` 倒序、相同时间按路径排序，并显示状态、最新报告时间、路径、主题标题、核心问题、报告数量和最新报告标题；没有命中不是错误。索引缺失、失效、定义不匹配或主题源在读取期间变化时失败，不返回可能过期的结果。

`sync-index` 不接受筛选。它先验证全部主题文件和当前资源，不读取、验证或要求既有索引新鲜；有 errors 时不写索引，只有 warnings 时继续只由主题 Markdown 确定性创建或替换 JSON 索引。任一主题无效、资源检查无法完成、主题源在同步期间变化或写入验证失败时退出失败。

`check` 与 `sync-index` 都返回确定性去重排序的 `errors` 与 `warnings`。CLI 在成功和失败路径均展示两者：errors 与命令失败使用 stderr，warnings 也使用 stderr；只有 errors 决定退出失败，只有 warnings 时仍在 stdout 输出成功结果。warnings 不进入索引、source revision、`list` 结果或 staging 状态。

### `stage-index`

`stage-index` 仅在工作区索引已经由 `sync-index` 从当前主题 Markdown 重建、并通过默认全量 `check` 后使用。命令本身不解析主题 Markdown、不读取随附资源，也不重建或验证工作区索引；成功只证明选中主题对应的索引结果已进入 `pending`，不证明工作区索引新鲜或领域文件有效。

命令至少接收一个 topic ID，不接受查询筛选或分页参数。每个 ID 必须逐字使用规范且不重复的 `<category-id>/<semantic-slug>.md` POSIX 路径；命令不替调用方 trim、改写反斜杠或推断重命名。移动主题时同时选择旧 ID 与新 ID。`--json` 只适用于该命令，并输出完整的 `status`、`state`、`changed`、`selectedIds`、`indexPath`、`namespace` 和 `diagnostics` 结果。

命令从 current revision 与已经存在的工作区索引按选中 ID 组合完整目标索引，在确认 `investigation-index.json` 没有既有 `pending` 后写入该路径的暂存结果；它不改写工作树，也不暂存主题 Markdown、随附资源或其他领域文件，这些文件必须由调用方另行选择。合法 ID 在两份索引中都不存在时在写入前失败。同一索引已有 `pending` 时也直接失败并保留原内容，目标外的 `pending` 路径不受影响。

资源成员、名称和字节不属于索引 metadata 或 source revision。两侧索引都使用 definition version 5 时，资源变化不触发调查领域的 `collection-changed`，`stage-index` 可以继续只组合选中主题条目；主题资源链接变化在同步后随对应 topic entry 选择。version 4 到 version 5 是集合定义升级，首次交付必须整体暂存重建后的索引，不进行跨 definition version 的选中条目组合。current revision 尚无调查索引时，首次合法主题选择可以暂存完整工作区索引，但主题和资源文件仍不会随之进入 `pending`。

CLI 不判断章节语义、证据质量、资源是否值得保存、资源来源可信度、敏感信息、历史修改正当性、场景义务、状态选择或拆分判断；这些由 `SKILL.md` 的形成与审阅流程承接。退出状态 `0` 表示成功，`1` 表示结构、资源、索引、版本仓库、pending 冲突或写入失败，`2` 表示参数错误。
