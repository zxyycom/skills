# 决策记录规则

本规则是 Decision Records 的写入、结构审阅和维护不变量 owner。写入候选、修改 tags、改变生命周期或关系、构造 `pending` 决策快照前必须完整读取。Agent 行为流程由 [SKILL.md](../SKILL.md) 承接；索引精确机器结构由 [decision-index.schema.json](decision-index.schema.json) 承接。

## 模型与权威

| 对象 | 含义 | 权威来源 |
| --- | --- | --- |
| Decision ID | 含 `.md` 的合法 basename；移动目录不改变 ID，改 basename 是身份变化 | Markdown 文件名 |
| tags | 非空、唯一、有序的记录级分类 token 集合 | Markdown frontmatter |
| status | `candidate`、`active` 或 `archived` 的生命周期事实 | Markdown frontmatter |
| sourcePath | 相对决策根的当前 POSIX 路径，只负责定位 | 文件系统；已建立记录由索引投影 |
| relation target | 指向直接前序的 Decision ID | 后继 Markdown frontmatter |
| decision index | 以 Decision ID 为键，投影已建立记录的 sourcePath、状态、tags、摘要和关系 | 从完整合法 Markdown 派生 |

Decision ID 必须符合 `^[a-z0-9]+(?:-[a-z0-9]+)*\.md$`；tag 必须符合 `^[a-z0-9]+(?:-[a-z0-9]+)*$`。同一集合内每个 Decision ID 只能解析到一个 Markdown。索引和 `sourcePath` 不能反向补造或改写身份、生命周期、tags、正文或关系。

## 布局、状态与 frontmatter

决策根目录的稳定布局是：

```text
docs/decisions/
├── decision-index.json
├── <decision-id>            # candidate 或 active
└── archive/
    └── <decision-id>        # archived
```

1. 根目录直属 Markdown 只能是 `candidate` 或 `active`；`archive/` 直属 Markdown 只能是 `archived`。状态和位置不一致、嵌套目录或跨位置同 ID 都是集合错误。
2. candidate 不进入正式索引；active 与 archived 由一个统一索引覆盖。archive 不建立第二索引。
3. `sourcePath` 对根目录记录等于 Decision ID，对 archived 记录等于 `archive/<decision-id>`。它不是身份，也不能用作关系、查询、生命周期或 stage 的输入。
4. `tags` 是当前分类提示，不表示 status、alignment、关系类型、当前事实或历史演进。分类维护不代替语义审阅。

新候选使用下列顺序；`tags` 位于 `decision` 之后、`relations` 之前：

```markdown
---
title: <标题>
status: candidate
alignment: null
createdAt: null
purpose: <精简目的>
background: <精简背景>
decision: <精简采用方向>
tags:
  - <tag>
relations: []
---

## 目的
- <希望长期达成或维护的结果>

## 背景
- <促成选择的事实、问题与关键约束>

## 决策
- 采用: <最终方向、核心理由和长期约束>
```

1. tags 至少一个，按 locale 无关的字符串词法升序排列，且同一记录内不得重复。
2. 标题和三项摘要是 4 至 100 个 Unicode 码点的单行文本；摘要不得引入正文没有表达的独立含义。
3. 正文只使用依次排列的“目的”“背景”“决策”二级章节，不重复一级标题、摘要或关系。决策至少包含一个非空“采用”。
4. 已建立记录只能直接进行不改变目的、范围、关键背景、采用方向或核心理由的编辑性修正。语义变化通过新记录和真实演进关系表达。
5. 候选必须已完整到可审核；半成品不写入决策根目录。候选可在审核前原地修改，合法候选关系同正文一起审核。

## 生命周期与对齐

| 状态 | 含义 |
| --- | --- |
| `candidate + alignment: null + createdAt: null` | 结构和内容完整、可审核，尚未建立；不进入正式索引。 |
| `active + aligned` | 已确认并进入当前集合，完整方向已成为当前事实并通过核对。 |
| `active + unaligned` | 已确认并进入当前集合，作为未来方向约束相关选择；这是正常状态，不表示失败、待办或实施授权。 |
| `archived + aligned/unaligned` | 不再作为当前依据，保留最后对齐状态与演进历史。 |
| 历史 `archived + alignment: null` | 只表示归档前事实关系未知。 |

1. `activate` 是审核与建立边界：首次建立把完整候选改为 active，选择非空 alignment 并写入不可变 createdAt。Git 提交、暂存或历史不参与建立状态。
2. alignment 始终作用于整条决策。只有完整方向成为当前事实并完成核对后才能从 unaligned 标记为 aligned；不得添加部分对齐状态。
3. 可分别修订、归档或对齐的部分说明原记录过粗，必须以闭合拆分建立自包含后继。不可独立演进的局部落地不改变整条记录的 unaligned 状态。
4. 已对齐记录后来与当前事实偏离时报告一致性问题，不改回 unaligned。新的未来目标使用新记录。
5. archive 保留最后一个非空 alignment；重新激活保留原 createdAt 和关系，并由本次参数建立当前 alignment。
6. `candidate` 不承接已经确认但尚未执行的方向；后者是 `active + unaligned`。Git pending 也不属于生命周期。

## 演进关系与事务

关系从新记录指向真实直接前序：

```yaml
relations:
  - type: 修订
    target: direct-predecessor.md
```

1. `修订` 保留主体方向并改变一部分；`替代` 以完整新判断取代前序；`判定无效` 表明前序依据不成立；`归并` 整合多个前序；`拆分` 把过粗前序重建为多个可独立使用的后继。
2. 每个 target 是合法 Decision ID，只出现一次，不自环、不成环。关系只保存语义演进，不作为分类、引用列表、任务依赖或实施映射。
3. 候选关系做类型、ID、重复、自环和目标可解析性前瞻检查，但在建立前不进入正式图，也不要求活动前序提前归档。
4. `evolve` 通过重复 `--successor <alignment=decision-id>` 显式选择完整后继集合。每个后继的来源关系，或调用方以重复 `--relation <type=decision-id>` 给出的完整替换集合，或 `--clear-relations` 的显式空集合，构成有效最终关系；三种意图不追加、不合并、不互相推断。
5. 非拆分的有效最终关系只允许一个所选后继；全部为归并时至少含两个不同前序。拆分必须显式选择至少两个后继，每个后继恰有一条指向同一前序的拆分关系，且选择集等于该前序的完整直接拆分后继集合。
6. 关系和生命周期变更使用 CLI 事务；它尽可能保证 Markdown 与索引组合的原子性。普通诊断无法恢复的失败按维护恢复处理。
7. 已建立记录的关系只能由完整关系事务修订。新候选可由 `activate` 的单后继便捷入口进入相同事务；重新激活 archived 记录不借激活修订关系。

## 维护不变量

1. 当前指令明确授权起草候选，或足以确认长期判断和维护范围时，才在相应边界内写入；新增记录或改变状态前告知用户将改变的判断和集合。
2. 候选、编辑性正文修正和 tags 可直接修改权威 Markdown；生命周期、对齐、归档和丢弃使用 CLI。已建立 Markdown 的手工修改后同步索引，并在维护或验收前运行严格 check。
3. Git `HEAD` 只用于在保留独立决策历史前要求再次确认，以及删除已记录决策的机械门禁；不参与候选、建立、生效、对齐或索引成员判断。在 Git 工作树中，尚无首次提交的 unborn `HEAD` 按空 Git `HEAD` 基线处理。可用 Git `HEAD` 基线中，单独 `archive` 的目标，以及本次关系事务中所选后继完整最终关系集里的每个已建立直接前序（relation target），只要尚未进入 Git `HEAD`，CLI 就暂停且不写入；无论前序是 active 还是 archived，调用方都必须以 `--keep-unrecorded-history` 显式确认后才可继续。该判断不使用形成时间。在 Git 工作树外没有这个确认门；但 stage 仍需要其自身的版本控制前提。
4. `discard` 删除完整、结构有效且在删除后的最终集合中无剩余引用的 candidate、active 或 archived 决策。它既可直接运行，也可通过 `evolve --discard <decision-id>` 与后继建立、最终关系修改和索引重建处于同一事务；被删除 ID 不能同时作为后继，所选后继的最终关系也不得保留该 ID。`evolve` 仍遵循普通演进的关系形状、闭包和最终图验证，不增加只适用于删除的后继数量、状态、前序或显式空关系限制。删除的 Decision ID 已进入 Git `HEAD` 时，未带 `--delete-recorded-decision` 的调用在其余删除条件和演进最终图都已通过后 attention 且零写入；带该参数即为明确的机械删除选择，不会为 discard 自身重复读取 Git `HEAD`，但不绕过同次 `evolve` 最终关系的独立 `--keep-unrecorded-history` 预检。非 Git 工作树、unborn `HEAD` 或 ID 未进入 `HEAD` 时正常删除；无参数且 `HEAD` 不可读取时 fail closed。调用方不主动预检 Git，只响应 CLI 实际提示。
5. `stage` 只是 Git pending 状态转换，不改变决策生命周期。`sourcePath` 变化是位置变化，stage 选择一次对应 ID 即可。stage 不从差异推断 basename 改名意图：只选新 ID 表示新增，只选旧 ID 表示删除，同时选旧、新 ID 才表达改名。生命周期移动、关系维护和 stage 都应在写前拒绝 revision、pending 或所选来源漂移。
6. 当前契约不提供其他格式、身份或位置模型的兼容读取、转换、双写、迁移或升级入口。

## 派生索引与查询

1. 索引从全部已建立 Markdown 完整生成，definition、metadata 与字段精确结构以 Schema 为准。metadata 是严格空对象，不保存分类注册表。
2. entry 与 source revision 以 Decision ID 为键。state 保存 sourcePath、tags、status、alignment、createdAt、摘要和关系；source revision 覆盖规范 ID、sourcePath 与规范 Markdown 内容。
3. 索引 keys 为多值 exact `tag`、exact `status` 和 exact `alignment`。`list` 默认 active；重复 `--tag` 的 AND 过滤要求每个 tag 都匹配。当前查询不推断分类，也不提供 OR、NOT、层级、别名或权重。
4. `show` 从索引按 ID 定位，只读取目标 Markdown 正文。`trace`、关系、生命周期和 stage 使用 ID；输出显示 ID、sourcePath 与 tags。
5. candidates 与 show-candidate 直接扫描根目录源码：单条非法 Markdown 产生 warning 并跳过，显式目标自身非法则失败；根目录、成员边界或已建立集合的索引前提错误属于集合级错误。候选始终排除于正式索引。
6. 索引缺失、损坏或陈旧时只能由权威 Markdown 重建，不能反向补造 Markdown 事实。常规查询读取结构有效的持久索引，不在每次查询前重扫整个集合。

## 验证

1. `check` 验证 Markdown、ID、tags、位置与状态、关系、索引结构、新鲜度、成员一致性及候选前瞻性结构，并计数合法候选。
2. Agent 另行检查记录门槛、tags 是否有正文依据、摘要与正文一致性、关系是否确属直接前序、拆分后继是否覆盖前序长期含义，以及对齐是否有完整当前事实证据。
3. 工具、索引或写入恢复出现普通诊断无法解释的故障时，停止猜测并读取 [维护恢复](maintenance-recovery.md)。
