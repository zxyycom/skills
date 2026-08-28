# 调查报告固定契约

本文件定义 `investigation-report` 的落盘结构、报告身份、可选资源引用、派生索引与 CLI 语义。报告可以不引用资源；只有声明 `随附资源` 时才产生引用关系和对应资源管理责任。何时保存形成时资源、怎样取得证据、怎样判断关系语义以及怎样审阅内容质量，由 [SKILL.md](../SKILL.md) 承接。

## Owner 与目录

1. Investigation ID 是符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$` 的稳定 Markdown basename，在集合内唯一。它同时是报告身份和相对调查根目录的唯一位置；改 basename 是身份变化。
2. 每个根目录直属报告 Markdown 是自身 title、formedAt、question、tags、relations、正文和资源引用的唯一事实源。一份文件只保存一份报告。
3. `investigation-index.json` 从全部合法报告确定性生成，只用于发现、过滤、排序、关系 trace 和资源引用投影，不拥有独立事实。资源成员、路径与字节不进入索引来源版本或新鲜度。
4. 可选 `_resources/` 是统一资源池。资源 ID 固定为 `<investigation-id-stem>/<resource-subpath>`，首段映射 owner 报告 `<investigation-id-stem>.md`；路径是资源唯一 owner 的事实来源，不限制其他报告引用。每个受管文件的原始字节是资源内容的事实源。
5. `scripts/check-investigations.mjs` 的 `check` 只读检查报告、关系图、当前资源和索引；`sync-index` 从完整已验证的报告集合创建或替换工作树索引；`list`、`show` 与 `trace` 查询索引；`set-relations` 事务化调整既有关系；`stage-index` 按 Investigation ID 对索引执行受控 pending 写入。除 `set-relations` 与 `sync-index` 外，命令不写报告或资源文件。
6. [investigation-index.schema.json](investigation-index.schema.json) 是随包分发的当前索引 JSON Schema；CLI 继续负责 Schema 无法证明的 Markdown、关系、资源安全、source revision、state 和 keys 一致性。

本文中的“工作区索引”指工作树内当前的 `investigation-index.json`；`pending` 指版本管理暂存区中的待提交内容。两者是同一路径在不同版本管理状态下的内容，不能互相替代。

```text
docs/investigations/
├── investigation-index.json
├── _resources/                         # 可选；没有资源引用时不需要创建
│   └── <investigation-id-stem>/...
└── <investigation-id>.md               # 每份报告根目录直属
```

调查根目录只接受派生索引、可选 `_resources/` 和根目录直属的报告 Markdown；不建立其他报告目录或生命周期目录。`_resources/` 中的 Markdown 是资源，不参与报告发现。

可以用 `--investigations-dir` 选择工作区内的其他调查根目录，但同一集合始终使用同一根目录。首次创建报告时先建立完整报告，再运行 `sync-index` 创建索引；不能以空索引代替首份有效报告。

## 报告 Markdown

报告从首行开始使用以下 YAML frontmatter，且 key 固定按 `title`、`formedAt`、`question`、`tags`、`relations` 排列。所有 scalar 是 string，禁止重复或未知 key；规范 writer 对 scalar 使用 JSON 兼容的双引号与转义。

```yaml
---
title: "重新检查索引来源"
formedAt: "2026-08-28T12:00:00+00:00"
question: "资源字节是否应影响报告索引来源版本？"
tags:
  - "investigation-report"
relations:
  - type: "复查"
    target: "exclude-resources-from-index-revision.md"
---
```

1. `title` 与 `question` 是非空单行语义文本。`formedAt` 使用带显式时区、无小数秒的 RFC 3339 时间戳。
2. `tags` 是至少一个 kebab-case token 的 YAML sequence；每项符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，同一报告内唯一并按 locale 无关词法升序排列。tags 只表达分类，不表达状态、有效性、关系、当前事实或历史演进。
3. `relations` 是完整直接前序集合。空集合固定写为 `relations: []`；非空项的 key 顺序固定为 `type`、`target`，并按关系类型表顺序、再按 target 的 locale 无关词法顺序排列。
4. frontmatter 后没有 H1。前四个 H2 依次且唯一为非空的 `形成时背景`、`调查目的`、`调查范围与依据` 与 `调查结果与边界`。
5. 报告声明资源时，第五个 H2 必须且只能为非空的 `随附资源`；章节内容是至少一个无序列表项，每项只含一个无 title 的本地 Markdown inline link。没有资源时不得创建该章节。
6. 其他可选语义 H2 只能位于四项固定核心之后；报告声明资源时，只能位于第五个 H2 `随附资源` 之后。
7. 每个资源链接展示文字的文本投影非空，链接目标逐字为 `./_resources/<resource-id>`，不能携带查询、片段、百分号编码、反斜杠或链接外文字。同一报告内 resource ID 唯一并按 locale 无关词法升序排列。

完整报告写入集合即建立。草稿留在当前任务或其他草稿 owner；新证据或实质认识变化创建新报告，只有当时认识未被准确保存、格式或链接错误时才原地修正。删除已建立报告必须有明确任务授权，并在同步前修复指向它的关系和受影响资源 owner。

## 关系图

关系从新报告指向真实直接前序。合法类型及其语义是：

| 类型 | 语义 |
| --- | --- |
| `补充` | 增加新的证据、范围、视角或更细认识，不否定前序核心结果。 |
| `复查` | 在新的时间、版本、环境、样本或约束下重新检查同一问题。 |
| `修正` | 纠正前序的部分事实解释、方法或结论，但未认定关键依据整体不足。 |
| `推翻` | 确认前序的关键依据、方法或假设不足以支持其主要结果。 |
| `归并` | 综合多个直接前序形成新的完整认识。 |
| `拆分` | 将一个过粗前序建立为多个可独立调查和演进的直接后继。 |

1. 每个 target 是已存在的 Investigation ID，不得重复、自环或晚于 source 的 formedAt；完整图必须无环。
2. 独立报告使用空关系。`补充`、`复查`、`修正` 和 `推翻`只指向一个直接前序；`归并`只能使用至少两个 target 的纯归并集合。
3. 每个`拆分`后继只能有一条指向同一前序的`拆分`关系，且没有其他关系；被拆分前序在完整集合中至少有两个直接拆分后继。
4. 关系只表达认识演进。不从相同 tags、时间先后、普通链接、资源共享或目录位置推断边；间接关系通过 trace 恢复。
5. 后继关系不写回前序、不改变前序位置或默认可见性。所有已建立报告都留在同一正式集合，任何关系都不产生隐藏或归档行为。
6. 默认全量 `check` 仅在可用 Git `HEAD` 基线中检查每条直接关系的 target（直接前序）。target 尚未进入 Git `HEAD` 时，返回包含 source、target 和 relation type 的确定性 warning，要求复核该关系是否应保留为独立调查演进；warning 不产生 error，也不阻断 `set-relations` 或其他写入。不比较 `formedAt` 或其他时间间隔。target 已进入 Git `HEAD` 时不提示；非 Git 工作区、尚未形成 `HEAD` 或无法建立可用 `HEAD` 基线时跳过此提示。

## 资源池与资源 ID

1. 相对 `_resources/` 的规范化 POSIX 文件路径是资源 ID，固定为 `<investigation-id-stem>/<resource-subpath>`。首段必须逐字对应 owner 报告 `<investigation-id-stem>.md`；resource-subpath 至少包含一个文件名，之后可以任意合法嵌套。
2. 资源 ID 不能是绝对路径，不能包含空段、`.`、`..`、反斜杠、查询、片段或百分号编码。每个路径段只允许常用汉字 `U+4E00..U+9FFF`、`〇`、大小写 ASCII 英文、ASCII 数字，以及固定契约允许的点、连接符、括号、方括号、书名号和中英文常用标点。
3. 路径段不能以 `.` 开头或结尾，至少包含一个汉字、英文字母或数字；拒绝 Windows 保留设备名及带扩展名形式。ASCII 圆括号必须成对，允许空内容与最多 32 层嵌套。
4. 被引用资源必须满足路径安全、精确大小写、存在性、普通文件身份和版本控制可见性。资源根、任一路径分量或文件本身为符号链接，目录目标、其他非普通文件、缺失目标和越过调查根目录的路径都被拒绝。
5. Git 工作区用 `git ls-files --cached --others --exclude-standard` 在 `_resources/` 范围内发现版本控制可见资源；非 Git 工作区完整发现文件系统资源。ignore 排除的未跟踪文件不产生未引用 warning，但报告引用它时失败；tracked 或显式进入 pending 的 ignored 文件保持可见。
6. 被引用资源的 owner 报告必须存在且直接引用该资源；其他报告可以共享引用，不改变 owner。完全未引用的版本控制可见资源及其 owner 或安全问题只产生 warning；一旦被报告引用，相应问题是 error。
7. 资源成员、名称和字节不属于索引 metadata 或 source revision。资源字节变化不要求同步索引；改变报告资源链接时，必须同步对应报告 entry。

## 索引、查询与维护

1. 每个 Investigation ID 产生一个索引 entry。state 投影 `title`、`formedAt`、`question`、`tags`、`relations` 和按规范 ID 排序的 `resourceIds`；不保存 sourcePath、正文、反向关系副本、当前结论或资源内容摘要。
2. keys 是 exact `tag`、range `formed-at`、exact `relation-type` 与 text `text`；text 只聚合 title 与 question。metadata 是拒绝额外字段的严格空对象。
3. source revision 以 Investigation ID 为键，只指纹化 ID 和完整报告 Markdown UTF-8 内容，计算前只把 CRLF 规范为 LF。报告成员或可投影内容变化会更新对应 revision；资源成员、名称和字节不参与 revision。
4. `list` 默认查询全部正式报告，按 Investigation ID 的 locale 无关词法顺序排序；支持可重复 `--tag` 的 AND、包含端点的 formedAt 范围、一个精确关系类型和 title/question 文本查询。`show <investigation-id>` 读取完整报告；`trace <investigation-id>` 支持 predecessors、successors、both 与非负 max-depth。
5. `check` 验证报告、完整关系图、资源与索引。scoped check 只验证命中报告及其直接引用，不证明完整图、拆分闭合、未引用资源集合或索引新鲜度。`sync-index` 不要求旧索引新鲜，先验证完整报告、关系图和资源，再从同一 Markdown snapshot 重建索引。
6. 创建、删除、改名报告或改变资源引用后运行 `sync-index`，然后运行默认全量 `check`。只改资源文件时运行默认全量 `check`；不得手工修补 JSON 代替维护流程。

### `set-relations`

```text
set-relations \
  --source <investigation-id> \
    (--relation <type=target-id>... | --clear-relations) \
  [--source <investigation-id> ...]
```

1. 每个 `--source` 开始一个完整替换组，直到下一个 `--source`；组内重复 `--relation` 构成该报告的全部最终关系，`--clear-relations` 表示显式空集合。每组必须二选一，同一 source 不能重复出现。
2. 所有 source 必须是已建立 Investigation ID。一次调用中的全部组共同组成最终图预演，因此多个拆分后继可以同一事务建立，不产生非法中间状态。
3. 命令要求工作区索引结构有效且对报告源新鲜，验证关系类型、目标、时间方向、归并/拆分形状和无环性；预演无效不写入。
4. 成功路径保护全部目标报告、索引和完整图预览的 revision，事务化改写选中 Markdown frontmatter 与工作区索引。写前漂移失败；中断或发布失败恢复完整旧组合或返回明确恢复诊断。
5. 命令不改 title、formedAt、question、tags、正文、资源或 Git pending。全部最终关系与现值相同时返回 `changed: false` 且不改写字节；至少一组改变时返回 `changed: true` 和规范 source ID 列表。

### `stage-index`

`stage-index <investigation-id...>` 只在工作区索引已由 `sync-index` 从当前报告集合重建并通过默认全量 `check` 后使用。它只组合选中报告的索引结果进入 pending，不自动暂存报告 Markdown、资源或其他领域文件；这些文件由调用方按实际提交范围选择。

选中的 ID 必须规范且不重复。ID 改名时同时选择旧、新 ID。命令不读取或重建报告与资源；同一索引已有 pending 时失败并保留原内容，目标外 pending 路径不受影响。成功不证明索引新鲜或报告、关系和资源仍有效。

## CLI

```text
node <investigation-report-skill>/scripts/check-investigations.mjs --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs sync-index --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs list --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs show <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs trace <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs set-relations --source <investigation-id> --clear-relations --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs stage-index <investigation-id...> --root <workspace-root>
```

无显式 command 时默认执行 `check`。CLI 返回确定性去重排序的 errors 与 warnings；只有 errors 决定失败。它不判断章节语义、证据质量、资源是否值得保存、资源来源可信度、敏感信息、历史修改正当性或关系语义是否真实直接；这些由 `SKILL.md` 的形成与审阅流程承接。
