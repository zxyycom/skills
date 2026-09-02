# 调查报告固定契约

本文件定义 `investigation-report` 的正式报告、authoring candidate、可选资源引用、派生索引与 CLI 语义。报告或 candidate 可以不引用资源；只有声明 `随附资源` 时才产生引用关系和对应资源管理责任。何时保存形成时资源、怎样取得证据、怎样判断关系语义以及怎样审阅内容质量，由 [SKILL.md](../SKILL.md) 承接。

## Owner 与目录

1. Investigation ID 是符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$` 的稳定 Markdown basename，在正式集合内唯一。正式报告以该 ID 作为相对调查根目录的唯一位置；改 basename 是身份变化。
2. candidate 的唯一文件名是 `_candidate.<investigation-id>`。candidate ID 由移除该保留前缀后恢复；它不是正式 Investigation ID、正式报告或索引成员。未知保留文件、符号链接、非普通文件、同一 ID 的多个 candidate，或 candidate 与正式报告同 ID 都是集合成员安全错误。
3. 每个根目录直属正式报告 Markdown 是自身 title、formedAt、question、tags、relations、正文和资源引用的唯一事实源。一份文件只保存一份正式报告。candidate 保存同形的未建立报告内容，但不成为正式集合事实。
4. `investigation-index.json` 从全部合法**正式**报告确定性生成，只用于发现、过滤、排序、关系 trace 和资源引用投影，不拥有独立事实。candidate、资源成员、路径与字节不进入索引来源版本或新鲜度。
5. 可选 `_resources/` 是统一资源池。资源 ID 固定为 `<investigation-id-stem>/<resource-subpath>`，首段映射 resource owner。正式 owner 是 `<investigation-id-stem>.md`；同 ID candidate 存在而正式 owner 未建立时，它可以在 authoring 中暂时承担该 owner。路径是唯一 owner 的事实来源，不限制其他候选或正式报告引用。
6. `scripts/check-investigations.mjs` 提供 `new`、`candidates`、`show-candidate`、`publish`、`discard-candidate`、`check`、`sync-index`、`list`、`show`、`trace`、`set-relations`、`discard` 和 `stage-index`。`new`、`publish`、`discard-candidate`、`sync-index`、`set-relations` 与正式 `discard` 写工作区领域状态，且共用集合 mutation lock；`stage-index` 只写 Git pending。其余操作只读。
7. [investigation-index.schema.json](investigation-index.schema.json) 是随包分发的当前索引 JSON Schema；CLI 继续负责 Schema 无法证明的 Markdown、candidate、关系、资源安全、source revision、state 和 keys 一致性。

本文中的“工作区索引”指工作树内当前的 `investigation-index.json`；`pending` 指版本管理暂存区中的待提交内容。两者是同一路径在不同版本管理状态下的内容，不能互相替代。

```text
docs/investigations/
├── investigation-index.json
├── _resources/                         # 可选；没有资源引用时不需要创建
│   └── <investigation-id-stem>/...
├── _candidate.<investigation-id>       # 集合外 authoring candidate
└── <investigation-id>                  # 每份正式报告根目录直属
```

调查根目录只接受派生索引、可选 `_resources/`、根目录直属正式报告与规范 candidate；不建立其他报告目录或生命周期目录。`_resources/` 中的 Markdown 是资源，不参与报告发现。

可以用 `--investigations-dir` 选择工作区内的其他调查根目录，但同一集合始终使用同一根目录。正式根目录的完整报告一旦写入即建立：`publish` 是 candidate 的正常事务入口，但不是形式上的唯一建立动作。`sync-index` 从正式报告全量验证并显式接纳手工来源变化。正式集合为空且索引不存在时，首次 publish 可以建立首批报告和索引；空索引不能代替首份有效报告。已建立集合通过正式 `discard` 删除最后一份报告时保留结构和来源版本均有效的空索引；该空索引可继续 `check`、`list` 和 `sync-index`，但不能让全新无索引空目录成为已建立集合。

## 报告与 candidate Markdown

正式报告从首行开始使用以下 YAML frontmatter，且 key 固定按 `title`、`formedAt`、`question`、`tags`、`relations` 排列。所有 scalar 是 string，禁止重复或未知 key；规范 writer 对 scalar 使用 JSON 兼容的双引号与转义。

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
4. frontmatter 后没有 H1。正式报告的前四个 H2 依次且唯一为非空的 `形成时背景`、`调查目的`、`调查范围与依据` 与 `调查结果与边界`。candidate 使用相同顺序与章节形状，但这四节可暂时为空。
5. 报告或 candidate 声明资源时，第五个 H2 必须且只能为非空的 `随附资源`；章节内容是至少一个无序列表项，每项只含一个无 title 的本地 Markdown inline link。没有资源时不得创建该章节。
6. 其他可选语义 H2 只能位于四项固定核心之后；声明资源时，只能位于第五个 H2 `随附资源` 之后。
7. 每个资源链接展示文字的文本投影非空，链接目标逐字为 `./_resources/<resource-id>`，不能携带查询、片段、百分号编码、反斜杠或链接外文字。同一文件内 resource ID 唯一并按 locale 无关词法升序排列。

candidate 的机械状态彼此独立：`scaffoldValid` 表示身份、普通文件、frontmatter、tags、relations 和章节形状合法；`bodyReady` 表示四项固定正文满足正式报告的非空要求；`resourceReady` 表示当前直接资源引用可安全解析且 owner 可解释。它们不证明调查结论、证据质量、关系真实性、资源可信或值得保存、语义审核或 publish 授权。候选可由 `new` 创建，完成后以 `publish` 建立，或以 `discard-candidate` 删除；不得通过手工改名把 candidate 当作已验证 publish。

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

1. 正式集合中的每个 target 是已存在的 Investigation ID，不得重复、自环或晚于 source 的 formedAt；完整图必须无环。publish 的最终集合可将 selected candidates 一并作为 target，但不能把未选择 candidate 当作关系闭包。
2. 独立报告使用空关系。`补充`、`复查`、`修正` 和 `推翻`只指向一个直接前序；`归并`只能使用至少两个 target 的纯归并集合。
3. 每个`拆分`后继只能有一条指向同一前序的`拆分`关系，且没有其他关系；被拆分前序在完整最终集合中至少有两个直接拆分后继。
4. 关系只表达认识演进。不从相同 tags、时间先后、普通链接、资源共享或目录位置推断边；间接关系通过 trace 恢复。
5. 后继关系不写回前序、不改变前序位置或默认可见性。所有未被正式 `discard` 的已建立报告都留在同一正式集合，任何关系都不产生隐藏、归档或自动删除行为。candidate 也不具有 lifecycle。
6. 默认全量 `check` 仅在可用 Git `HEAD` 基线中检查每条正式直接关系的 target（直接前序）。target 尚未进入 Git `HEAD` 时，返回包含 source、target 和 relation type 的确定性 warning，要求复核该关系是否应保留为独立调查演进；warning 不产生 error，也不阻断 `set-relations` 或其他写入。不比较 `formedAt` 或其他时间间隔。target 已进入 Git `HEAD` 时不提示；非 Git 工作区、尚未形成 `HEAD` 或无法建立可用 `HEAD` 基线时跳过此提示。

## 资源池与 resource owner

1. 相对 `_resources/` 的规范化 POSIX 文件路径是资源 ID，固定为 `<investigation-id-stem>/<resource-subpath>`。resource-subpath 至少包含一个文件名，之后可以任意合法嵌套。
2. 资源 ID 不能是绝对路径，不能包含空段、`.`、`..`、反斜杠、查询、片段或百分号编码。每个路径段只允许常用汉字 `U+4E00..U+9FFF`、`〇`、大小写 ASCII 英文、ASCII 数字，以及固定契约允许的点、连接符、括号、方括号、书名号和中英文常用标点。
3. 路径段不能以 `.` 开头或结尾，至少包含一个汉字、英文字母或数字；拒绝 Windows 保留设备名及带扩展名形式。ASCII 圆括号必须成对，允许空内容与最多 32 层嵌套。
4. 被引用资源必须满足路径安全、精确大小写、存在性、普通文件身份和版本控制可见性。资源根、任一路径分量或文件本身为符号链接，目录目标、其他非普通文件、缺失目标和越过调查根目录的路径都被拒绝。
5. Git 工作区用 `git ls-files --cached --others --exclude-standard` 在 `_resources/` 范围内发现版本控制可见资源；非 Git 工作区完整发现文件系统资源。ignore 排除的未跟踪文件不产生未引用 warning，但报告或 candidate 引用它时失败；tracked 或显式进入 pending 的 ignored 文件保持可见。
6. 正式报告引用资源时，正式 owner 报告必须存在且直接引用该资源；其他正式报告可以共享引用，不改变 owner。candidate 引用自身 owner 资源时，同 ID candidate 可以在正式 owner 未建立前暂时满足 authoring ownership；它必须直接引用该资源，其他 candidates 仍可共享。candidate 也可以引用既有正式 owner 的共享资源，但不可以替代一个应当存在的正式 owner。
7. 完全未引用的版本控制可见资源及其 owner 或安全问题只产生 warning；一旦被正式报告引用，相应问题是 error。candidate query 与 publish 对目标资源 fail closed；默认全量 `check` 不让合法 candidate 的正文或资源未就绪阻断无关正式集合。
8. 资源成员、名称和字节不属于索引 metadata 或 source revision。资源字节变化不要求同步索引；改变正式报告资源链接时，必须同步对应正式 entry。publish 不写、移动、改名或暂存资源，但会在提交前重新核对所选 candidates 的直接引用与相关资源成员；必要路径、引用、普通文件身份或版本控制可见性漂移时零写入失败。

## Candidate 查询、创建与丢弃

### `new`

```text
new <investigation-id> --title <title> --formed-at <rfc3339> --question <question> --tag <tag>... [--relation <type=target-id>...]
```

1. `new` 接收规范且未占用的 Investigation ID、非空 title、formedAt、question、至少一个 tag 和零个或多个完整直接 relation；重复 tag、relation 或不规范 metadata 是参数错误。formedAt 必须由调用方显式提供，不能用创建时间、文件时间、Git 或正文猜测。
2. 命令在集合 mutation lock 内重读正式/candidate 身份，使用完整临时内容原子且不覆盖地发布 `_candidate.<investigation-id>`。输入、锁、身份、安全或发布失败不产生或覆盖目标。
3. 创建成功即退出 `0` 并输出 candidate 路径。随后分别渲染 body/resource readiness 与单候选辅助 preflight；incomplete、attention、selection-incomplete 或 unavailable 是 stderr warning，不改变创建成功，不生成 receipt，也不要求重跑 `new`。下一步是编辑、`show-candidate` 或 `publish --preflight`。

### `candidates` 与 `show-candidate`

`candidates` 按规范 candidate ID 排序发现候选；`show-candidate <investigation-id>` 返回原文以及 `scaffoldValid`、`bodyReady`、`resourceReady` 和定位诊断。它们不读取或更新正式索引，不构成语义审核、关系事实或发布授权。单条非法 candidate 产生 warning 并在集合安全允许时跳过；显式目标自身非法则失败。

### `discard-candidate`

```text
discard-candidate <investigation-id> [--delete-owned-resources] [--delete-recorded-candidate]
```

1. 命令只接受一个已存在的 candidate ID。它不读取、重建或更新正式索引，不调整正式关系，也不删除正式报告。
2. 目标 owner 前缀下存在受管资源时，调用方必须用 `--delete-owned-resources` 显式选择删除全部这些资源。任一正式报告或其他 candidate 仍引用这些资源时拒绝，调用方须先显式迁移资源 owner 或更新引用；命令不猜测或自动转移 owner。
3. Owner 资源树、Git `HEAD` 确认、集合锁、精确 tombstone、成员漂移、发布前恢复与提交后 cleanup 的安全规则与正式 `discard` 相同，但该事务只拥有 candidate 及其经确认资源范围。已记录 candidate 或资源第一次调用零写入要求 `--delete-recorded-candidate`；发布后 cleanup 残留仍使用 `committed-cleanup-pending`。

## 索引、查询、publish 与相邻维护

1. 每个正式 Investigation ID 产生一个索引 entry。state 投影 `title`、`formedAt`、`question`、`tags`、`relations` 和按规范 ID 排序的 `resourceIds`；不保存 sourcePath、正文、candidate、反向关系副本、当前结论或资源内容摘要。
2. keys 是 exact `tag`、range `formed-at`、exact `relation-type` 与 text `text`；text 只聚合 title 与 question。metadata 是拒绝额外字段的严格空对象。
3. source revision 以正式 Investigation ID 为键，只指纹化 ID 和完整正式报告 Markdown UTF-8 内容，计算前只把 CRLF 规范为 LF。正式报告成员或可投影内容变化会更新对应 revision；candidate、资源成员、名称和字节不参与 revision。
4. `list` 默认查询全部正式报告，按 Investigation ID 的 locale 无关词法顺序排序；支持可重复 `--tag` 的 AND、包含端点的 formedAt 范围、一个精确关系类型和 title/question 文本查询。`show <investigation-id>` 读取完整正式报告；`trace <investigation-id>` 支持 predecessors、successors、both 与非负 `--depth`。这些命令与 `stage-index` 完全忽略 candidates。
5. 默认全量 `check` 验证正式报告、完整关系图、资源与索引；合法 candidate 只进行成员安全、身份冲突和候选诊断，不被接纳为正式来源。scoped check 只验证命中正式报告及其直接引用，不证明完整图、拆分闭合、未引用资源集合或索引新鲜度。
6. `sync-index` 不要求旧索引新鲜；它在集合 mutation lock 内验证完整**正式**报告、关系图和资源，再从同一正式 Markdown snapshot 重建索引。它忽略合法 candidates，只因 candidate 路径或身份不安全而阻断。锁冲突时命令零写入失败并要求在当前事务结束后重试。已建立空集合只有在当前有效索引存在时成立。
7. `sync-index` 是完整正式集合的低频重建、恢复与显式接纳入口。一批手工正式创建、修正、改名或资源引用调整可以先共同完成；在 `list`、`show`、`trace`、已有关系事务、正式 `discard`、默认全量 `check`、`stage-index` 或交付需要当前索引前运行一次。批量编辑期间索引可以暂时陈旧，此时使用 scoped check 或直接读取 Markdown；陈旧索引不提供当前集合事实。

### `publish`

```text
publish <investigation-id...> [--preflight]
```

1. `publish` 至少选择一个规范且不重复的 candidate ID。`--preflight` 与普通 publish 接受相同选择，完成相同最终集合准备但零写入；它不获取 mutation lock，不改名 candidate、不写正式报告、索引、资源或 pending，也不保存 receipt。
2. 准备使用的正式基线必须明确：正式报告非空时，持久索引必须结构有效且对全部正式 Markdown 新鲜；正式报告为空而索引存在时，索引必须是当前合法空基线；正式报告为空且索引不存在时，允许首次建立。其他缺失、损坏或陈旧基线，以及未索引、已删除或已修改的手工正式来源，都要求先 `sync-index`，不得由 publish 混合接纳。
3. 准备把显式 selected candidates 的完整 report view 加入正式基线，验证正式 body、formedAt、tags、完整直接关系、时间方向、归并/拆分闭包、无环图、资源和最终规范索引。关系 target 只能来自正式基线或同一选择；未选择 candidate 不能补齐闭包。Git `HEAD` 中未记录前序和 history unavailable 保留当前非阻断 warning 语义。
4. 普通 publish 在集合 mutation lock 内重新读取正式来源、索引、selected candidates 与相关资源并重做准备。全部通过后，以不覆盖改名把每个 `_candidate.<id>` 发布为 `<id>`，再原子发布包含全部正式报告的索引；索引发布是领域提交点。普通 publish 只建立 selected IDs，未选择 candidate、资源与其他工作保持不变。
5. 索引发布前失败恢复全部已改名 candidate 和旧索引；无法完整恢复时返回 `partial-or-unknown`。索引发布成功后正式报告和索引已经提交，后续 cleanup 失败返回 `committed-cleanup-pending`。资源字节变化本身不阻断 publish，也不使索引陈旧。

### 已建立报告的相邻维护

`set-relations`、正式 `discard` 与 `stage-index` 都只接收已建立正式 Investigation ID。前两者在需要根目录安全时识别 candidate 文件，但不得 publish、修改或删除它们。`set-relations` 与正式 `discard` 要求当前索引，并在成功事务中同步索引；只改资源文件时保留当前索引并运行默认全量 `check`。报告索引只通过领域命令维护。

`set-relations`、正式 `discard` 和 `stage-index` 的参数、事务、确认与 pending 语义不因 candidate 改变，继续如下：

### `set-relations`

```text
set-relations \
  --source <investigation-id> \
    (--relation <type=target-id>... | --clear-relations) \
  [--source <investigation-id> ...]
```

1. 每个 `--source` 开始一个完整替换组，直到下一个 `--source`；组内重复 `--relation` 构成该报告的全部最终关系，`--clear-relations` 表示显式空集合。每组必须二选一，同一 source 不能重复出现。
2. 所有 source 必须是已建立 Investigation ID。一次调用中的全部组共同组成最终图预演，因此多个拆分后继可以同一事务建立，不产生非法中间状态。
3. 命令要求工作区索引结构有效且对正式报告源新鲜，验证关系类型、目标、时间方向、归并/拆分形状和无环性；预演无效不写入。
4. 成功路径保护全部目标报告、索引和完整图预览的 revision，事务化改写选中 Markdown frontmatter 与工作区索引。写前漂移失败；中断或发布失败恢复完整旧组合或返回明确恢复诊断。
5. 命令不改 title、formedAt、question、tags、正文、资源或 Git pending。全部最终关系与现值相同时返回 `changed: false` 且不改写字节；至少一组改变时返回 `changed: true` 和规范 source ID 列表。

### `discard`

```text
discard <investigation-id> [--delete-owned-resources] [--delete-recorded-report]
```

1. `discard` 是独立的破坏性删除事务，不是 lifecycle 或关系类型。命令只接受一个已建立 Investigation ID，不在同一调用中调整关系、迁移资源 owner 或写 Git pending。
2. 命令要求完整正式报告集合、关系图和资源有效，且工作区索引对同一 Markdown snapshot 新鲜。任何其他正式报告仍以关系指向目标时拒绝；移除目标后的完整图仍须满足无环、时间方向、关系形状和拆分闭合。
3. 目标 owner 前缀下存在受管资源时，调用方必须用 `--delete-owned-resources` 明确选择删除全部这些资源。任一 owner 资源仍被正式报告或 candidate 引用时拒绝，调用方须先显式迁移资源并更新引用；命令不猜测或自动转移 owner。
4. Owner 资源树只能包含路径合法、版本控制可见、非符号链接的普通受管文件与目录。Ignored、非法路径、符号链接、非普通实体、无法完整检查的成员或写前成员漂移都阻断整个事务，不能通过递归删除吞掉未预演字节。
5. 在可用 Git `HEAD` 中，只要目标报告或任一将删 owner 资源已经记录，首次调用就返回确定性确认诊断且零写入；明确确认后用 `--delete-recorded-report` 重试。非 Git 工作区或 unborn `HEAD` 不要求该参数；Git 或成员检查异常必须 fail closed，不能当作未记录。
6. 事务与 `sync-index`、`set-relations`、publish 和 candidate mutation 共用集合 mutation lock，在锁内保护正式报告集合、索引和 owner 资源成员。它先把目标报告与经确认资源移动到同文件系统 tombstone，复核最终文件与目录成员后原子发布新索引。索引发布是领域提交点：发布前任一步失败都恢复报告、资源和索引，恢复不完整时返回可行动诊断；发布后只精确清理已预演成员，不递归删除未知成员。
7. 索引发布后（已跨过领域提交点），tombstone 清理无法完整完成时，命令返回 `changed: true` 和包含残留路径的 cleanup 诊断；报告已经退出集合，索引已是最终投影，未清理成员留在 tombstone 供人工处理。成功删除最后一份报告时保留合法空索引。索引发布前失败和等待确认路径不改变报告、资源、索引或现有 Git pending。

### `stage-index`

`stage-index <investigation-id...>` 只在工作区索引已由 `sync-index` 从当前正式报告集合重建并通过默认全量 `check` 后使用。它只组合选中正式报告的索引结果进入 pending，不自动暂存报告 Markdown、candidate、资源或其他领域文件；这些文件由调用方按实际提交范围选择。

选中的 ID 必须规范且不重复。ID 改名时同时选择旧、新 ID。命令不读取或重建报告与资源；同一索引已有 pending 时失败并保留原内容，目标外 pending 路径不受影响。成功不证明工作区索引新鲜或正式报告、关系和资源仍有效。

## CLI 诊断与维护恢复

CLI 的成功信息写入 stdout；失败和 warning 立即写入 stderr，只描述本次命令，不保存持久日志、遥测或 receipt。最终诊断至少包含 `code`、对象、原因和下一步；有可靠系统证据时才附带 `causeCategory`、操作或经过净化的 `detail`。warning 表示检查未完成或需要关注；它不使本次命令失败，但在依赖相关集合状态前必须处理。warning 不会自行改写 candidate、正式报告、索引、资源或 pending，也不替代阻断错误。

只有 mutation 失败才报告 `scope` 和 `outcome`。`no-change` 表示声明范围未变，`rolled-back` 表示索引提交点前失败后完整恢复，`partial-or-unknown` 表示无法证明完整恢复，`committed-cleanup-pending` 表示领域提交点已经越过但后续清理仍待处理。普通查询、检查、candidate readiness、publish preflight 和参数错误不带这些字段。`stage-index` 的范围仅限目标 pending 索引；关系、同步、正式 discard、candidate discard 与 publish 分别只声明自己实际拥有的工作区范围。

按诊断先解决权限、竞争、内容归属、基线漂移或残留 cleanup，再显式重新执行命令。不得使用 `sudo`、自动删除锁或自动重试。busy 时先等待或确认活动进程；恢复不完整或范围无法唯一对账时，停止后按[维护恢复](maintenance-recovery.md)保存来源、核对范围并交给相应 owner。

## CLI

```text
node <investigation-report-skill>/scripts/check-investigations.mjs new <investigation-id> --root <workspace-root> ...
node <investigation-report-skill>/scripts/check-investigations.mjs candidates --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs show-candidate <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs publish <investigation-id...> [--preflight] --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs discard-candidate <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs sync-index --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs list --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs show <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs trace <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs set-relations --source <investigation-id> --clear-relations --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs discard <investigation-id> --root <workspace-root>
node <investigation-report-skill>/scripts/check-investigations.mjs stage-index <investigation-id...> --root <workspace-root>
```

无显式 command 时默认执行 `check`；公开 help 的 usage 使用 `investigation-report`，并按子命令展示合法参数。CLI 只提供人类可读文本，不提供 JSON 输出协议。退出码 `0` 表示成功，`1` 表示检查、领域操作或删除确认未通过，`2` 表示 CLI 参数无效。`new` 的成功只表示 candidate 已创建，即使其辅助 readiness/preflight 有 warning 仍退出 `0`；`publish --preflight` 按发布门禁退出。CLI 返回确定性去重排序的 errors 与 warnings；只有 errors 决定失败。它不判断章节语义、证据质量、资源是否值得保存、资源来源可信度、敏感信息、历史修改正当性或关系语义是否真实直接；这些由 `SKILL.md` 的形成与审阅流程承接。
