# 卡片契约

本文件拥有 novel-cards 的字段、目录、身份、引用与变迁效力。写作判断与修改传播见 [SKILL.md](../SKILL.md)；命令、批量输入、恢复、索引与预算见 [本地 CLI 操作契约](local-cli.md)。

## 项目布局

```text
<project>/
├── cards/                 # 本作普通卡，直接或任意子目录组织
├── reference/             # 可选独立来源，作者选用后才进入本作规划
├── history/snapshots/     # 对象和变迁的完整旧版本
├── history/transitions/   # 当前专门变迁记录
├── card-index.json        # 派生定位索引
├── manuscripts/           # 建议正文位置，工具不扫描
└── reports/               # 正文反推、对应与对照报告，工具不扫描
```

`cards/` 必须是真实目录，空集合合法。其余受管区可缺失，存在时必须是真实目录；`history/` 只允许 `snapshots/` 与 `transitions/` 两个子目录。受管区只接收普通、单硬链接 `.md` 文件与真实子目录，拒绝符号链接、其他成员和读取失败。目录深度上限 100，与卡片图的递归层数无关。

目录表达内容职责，卡内 `status` 表达发生状态。未来规划仍存本作卡，参考区只隔离来源；历史总结可放本作卡，专门变迁只放 `history/transitions/`（其旧版可在快照区）。

## 稳定身份与章节定位

| 信息 | 契约 |
| --- | --- |
| `id` | 必填；稳定对象身份，匹配 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，不含路径、扩展名或版本后缀；改名、重排、移动不改变身份 |
| `version` | 正整数，缺省 1；精确版本引用为 `id@N`。同对象可保留多个版本，全项目不能重复 `id@N`；非快照区不能重复稳定 ID |
| `title` | 必填非空显示名称，可以重用；标题查询只提供候选 |
| `chapter` | 可选，仅 `plot`；`{scope: 实际 plot 卡的稳定 ID, number: 正整数}`。计数范围如全作或具体卷由小说约定；同一区域的当前卡在同 scope 内编号唯一，快照不占用当前编号 |

日常先按标题或章节编号列候选，用 `scopeTitle` 确认计数范围，再按实际 ID 读取。编号可随插章或重排调整；稳定身份通过 `new-id` 获取，后续引用使用 ID，而不是从章号派生身份。

## 普通卡字段与正文

以下示例可单独建立；需要关联的对象实际创建后再写引用。

```markdown
---
id: gate-scene
version: 1
title: 雨夜门禁
kind: detail
domain: plot
status: expected
completeness: expanded
---

## 细纲
主角用通行额度换取入口，承受明确代价。

## 导演视角
先展示限额，再揭示交换代价。
```

| 字段 | 契约 |
| --- | --- |
| `kind` | 必填 `summary` 或 `detail`；专门变迁使用 `transition`（见下） |
| `domain` | 必填 `plot`、`character`、`setting` 或 `history`；普通历史卡仅 `summary`，用于压缩解释 |
| `status` | 必填 `occurred`（已发生）、`expected`（作者预期尚未发生）或 `mixed`（范围混合，仅普通 `summary`）；与版本和完整度独立 |
| `completeness` | 必填 `planned`（待展开）或 `expanded`（已展开）；来源型总结和无下级远期总结均合法，完整度由作者声明并语义复核 |
| `labels` | 可选字符串数组，每项非空；卷、册、弧线、章等组织标签，不定义层级或编号 |
| `children` | 可选精确引用数组，默认空；总结的组成与顺序，详情与变迁仅可空或省略 |
| `sources`、`refs` | 可选精确引用数组，默认空；分别表达依据和其他关联，不自动遍历；交叉依据可形成环 |
| `story_time`、`narrative_position` | 可选非空显示字符串，分别表达故事时间和叙述位置；工具不做时间算术，作者修订不使用 `story_time` |
| `state_at` | 人物/设定详情必填，其他卡可选；精确引用实际 `plot` 卡，作为状态位置锚点 |
| `relations` | 可选，仅 `character`；有向数组，每项必填 `target`（人物引用）、`relation`、`attitude`、`knowledge`（后三项为非空文本） |

未知字段、空正文、错误类型与 `children` / `sources` / `refs` 内重复引用均拒绝。卡片正文使用自由 Markdown，文学段落标题由小说选择。人物/设定详情区分核心信息与位置状态；关系双向各写一条，态度与所知分别复核。

小说正文只承接小说文本，卡片对应、定位与版本证据由外部报告保存；稿件无需 frontmatter、卡片链接或回标。

## 引用、组成与历史语境

- 普通引用 `id` 指当前版本；`id@N` 锁定完整版本，快照移动仍可定位。`children`、`sources`、`refs`、`state_at` 与人物关系均使用这一规则。
- `children` 须同 `domain`，历史总结还可包含 `plot`；组成图必须无环。本作 `children` 可以显式纳入同域版本快照，但不能纳入参考卡。参考成为本作组成前，先建立本作规划卡，由作者确认采用。
- `sources`、`refs`、`state_at` 与关系可以显式引用参考，引用只表示关联，不表示采用。依据、关系与锚点正文须按任务另行读取。
- 卡片正文受管链接为 `[说明](card:id)` 或 `[说明](card:id@N)`，包括代码中出现的字面链接；目标须实际存在。自然语言、wiki、文件链接等不属于受管引用保证。
- 旧快照内的普通引用也指当前；锁版本才保证所引对象的历史版本。版本号不表示故事时间，快照存在不表示内容仍是故事事实。

`show` 的 `referenceContext` 检查 `children`、`sources`、`refs`、`state_at`、人物关系目标与正文受管链接；`chapter.scope` 是当前定位字段，不计入这一标记，也不提供历史范围锁定。标记明确区分：

| 值 | 可确认语境 |
| --- | --- |
| `current` | 当前卡语境 |
| `snapshot-version-locked` | 快照的上述内容引用均锁定版本（也可能没有这些引用） |
| `snapshot-unqualified-current-not-historical` | 快照含未锁引用，这些引用指当前，不保证历史语境 |

快照展开对未锁 `children` 的拒绝与读取预算见 CLI 契约；语义上也不能把未锁的其他引用冒充历史内容。

## 专门变迁记录

变迁使用 `kind: transition`、`domain: history`，沿用身份、标题、发生状态与完整度字段；`children` 仅可空或省略，`status` 仅 `occurred` / `expected`。正文说明变化原因、影响与语义。以下为 frontmatter 示例，所引版本必须实际存在，完整记录还须补正文。

```yaml
id: public-review-change
version: 1
title: 公开复核改变责任分配
kind: transition
domain: history
status: occurred
completeness: expanded
transition:
  mode: evolution
  lifecycle: active
  events: [public-review@1]
  changes:
    - {before: hero@1, after: hero@2}
    - {before: gate@1, after: gate@2}
```

`transition` 仅专门变迁可用且必填：

| 子字段 | 契约 |
| --- | --- |
| `mode` | 必填 `evolution`（故事演进）或 `revision`（作者修订） |
| `lifecycle` | 必填 `active` 或 `withdrawn` |
| `events` | 必填、可空的锁版本 `plot` 引用数组；演进至少一个事件，已发生演进只能以已发生剧情版本为依据 |
| `changes` | 必填、至少一项 `{before, after}`；端点均锁版本、同对象同域且不是变迁，`after.version > before.version`，每次每对象最多一项 |
| `supersedes` | 可选，默认空；仅作者修订可非空，锁定其他 `evolution` 记录版本，否定该记录的整组 `changes` |

`events` / `supersedes` 内引用不能重复。版本端点可以跳跃以纠正已有历史关系；实际批量替换当前卡时的 `+1` 规则由 CLI 契约承接。

### 演进、修订与记录效力

- **故事演进**保存真实前后阶段，旧状态仍是过去事实。事件、状态位置和正文解释共同支持作者复核，工具不从版本先后推断故事时序。
- **作者修订**纠正模型或记录，旧设定留作溯源而非人物经历；不使用 `story_time`。修改同一变迁使用同 ID 更高版本，完整保存旧记录，当前查询采用新版本。
- **替代其他演进**使用 `supersedes`。例如原演进同时改变人物和制度，作者只纠正人物：若修订替代整条原记录，其 `changes` 还须完整重述仍成立的制度前后关系，否则制度查询会丢失该次关联。也可直接更新原变迁的完整新版本，不能期望工具局部推断保留。
- **撤回**以更高版本记录 `lifecycle: withdrawn`；当前历史查询排除它，旧版仍可 `show id@N`。撤回修订后，原演进只有在未被其他有效修订替代时才恢复查询效力；撤回不自动回滚对象内容。
- **预期**是计划。`expected` 修订的 `supersedes` 不生效，任何 `expected` 变迁不能应用对象更新，也不能覆盖同身份已发生记录。计划可另建身份保留，待作者确认发生后再维护。

### 自动历史关联

`history` 从当前 `active` 专门变迁的 `events` / `changes` 派生对象→变迁、事件→变迁与变迁→前后版本，无需手工回填反向表。查询排除被当前 `active` 且 `occurred` 修订明确 `supersedes` 的记录版本；预期记录仍可返回，但明确标出 `status`，不能当作已发生经历。

普通历史总结只压缩解释，不自动成为变迁事实。关系查询只返回关联与版本端点，完整内容须再显式读取。快照与有效关系提供可信工作区的版本保护，不是防篡改审计库；因果、人物理解和文学质量仍由作者与 agent 判断。
