# Change Plan 固定结构与 CLI 契约

本文件是 Change 目录、`.change-plan.json`、artifact 结构、合法 stage、旧版 active metadata
兼容读取、Git 距离和 CLI 机械行为的唯一精确契约。`SKILL.md` 负责内容写作、语义审阅和
授权门禁；本文件只固定工具能够确定性执行的边界。

## 状态模型

Change 使用两个互不替代的概念：

| 概念 | 合法值 | 事实来源 |
| --- | --- | --- |
| status | `active`、`archived` | Change 所在目录。 |
| stage | `draft`、`plan` | Active Change 的规范 `.change-plan.json`。 |

标准生命周期是 `active/draft -> active/plan -> archived`。Archived Change 的 stage 为 `null`；
Readiness、Implementation 和 Verification 的 checkbox 只表达 Plan 内任务进度。

## Change 目录与 metadata

1. 每个 Change 使用独立目录，目录名必须是小写英文、数字和连字符组成的 kebab-case。
2. Change 根目录优先服从目标项目约定；项目没有约定时使用 `changes/`。
3. Change 根目录的直接子目录表示 active Change；`archive/` 的直接子目录表示 archived Change：

   ```text
   <change-root>/
   ├── <active-change-name>/
   │   └── .change-plan.json
   └── archive/
       └── <archived-change-name>/
   ```

4. Active Change 及当前检查所需的文件都必须位于真实 Change 目录中并且是普通文件；目录、`.change-plan.json` 或 artifact 为符号链接时检查失败且不会跟随链接。
5. Active Change 必须包含 `.change-plan.json`。缺失、无法读取、规范字段组合不合法或存在未定义字段时检查失败；旧版 active metadata 按“兼容读取”处理。
6. Archived Change 保留完整三个 artifacts；归档时随目录保留的 `.change-plan.json` 只作为历史文件，checker 不要求、读取或解释它，stage 为 `null`。
7. 可以增加交付说明或证据文件；附加文件不参与固定结构检查，也不能代替当前 stage 要求的 artifacts。
8. Catalog 只发现上述两层普通目录，不递归发现更深层 Change，也不把文件或符号链接作为列表成员。
9. `plan` 与 `archive` 在受信工作区中由单一操作者执行。命令运行期间，目标 Change、Change 根和
   archive 路径的命名空间保持稳定；工具拒绝已观察到的符号链接、身份变化和目标冲突，但不把这些
   路径检查当作跨进程锁或恶意并发改名隔离。

规范 metadata 不包含 schema version，以 `stage` 判别且每个对象只允许对应示例中的字段。规范
parser 与 writer 只接受和写入以下结构：

Draft：

```json
{
  "stage": "draft"
}
```

Plan：

```json
{
  "stage": "plan",
  "baseCommit": "<non-empty-revision>"
}
```

`baseCommit` 是不含空白的非空字符串，表示最后一次成功运行 `plan` 时读取的 `HEAD`，只作为
后续 Git 距离起点。Artifacts 的工作树、index 和提交内容不参与设置或解释此基线。

### 兼容读取

Active metadata 的读取边界额外接受下列旧形状，并只投影为查询、检查、`plan` 与 `archive`
所需的 Plan 输入：

| 旧 metadata | 只读投影 |
| --- | --- |
| `implementation` 加有效 `baseCommit` | `plan`，保留基线。 |
| `shelved` 加有效 `baseCommit` 与旧 `shelf` | `plan`，保留基线；`shelf` 不产生新语义。 |
| `plan` 加 `baseCommit: null` | 可发现的 `plan`，但基线不可用。 |

旧 `shelved` metadata 的 `shelf` 只接受以下两个严格对象。

显式原因：

```json
{
  "source": "explicit",
  "atCommit": "<revision>",
  "reason": "<首尾无空白的非空文本>"
}
```

Git 距离证据：

```json
{
  "source": "git-distance-v1",
  "atCommit": "<revision>",
  "changedLines": 0,
  "commitCount": 0
}
```

`atCommit` 与 `baseCommit` 使用同一 revision 约束：非空且不含空白。第二种对象中的
`changedLines` 和 `commitCount` 分别接受任意非负安全整数；示例中的 `0` 是合法下界。
两个 `shelf` 对象都拒绝额外字段。

兼容 reader 不写文件、不增加公共 stage 值，也不读取 archived metadata。旧 `shelf` 只用于
识别输入形状，不产生暂停或其他控制语义。`list`、`show` 和 checker 将前两种旧形状报告为
`plan`；只要基线可用，它们不因旧形状单独失败。`baseCommit: null` 没有距离证据，`check`
返回基线不可用诊断，`list` 和 `show` 仍可发现目标。操作者完成语义复核并显式运行 `plan` 后，
writer 才以当前 `HEAD` 写回规范 Plan metadata。

读取边界按 lstat、读取、JSON parse、schema parse 的顺序完成一次校验；writer 使用规范 runtime
schema，在同目录完成整个临时文件后直接发布到 metadata 路径，不解析或写入符号链接的外部目标。
Writer 只属于内部持久化边界。Change Plan 不生成 metadata JSON Schema 或分发类型声明。

## Artifact 结构

### 通用 Markdown 规则

1. 每个受检查的 artifact，其首个非空行必须是唯一 H1，且标题与对应模板完全一致。
2. H1 与首个 H2 之间必须有非空 Change 摘要。
3. 必需 H2 必须各出现一次，并作为文件开头的 H2 序列按模板顺序排列；每节必须有非空语义内容。
4. 必需序列之后可以追加 H2；新增章节不能改变或代替必需章节。
5. 固定标题使用英文，正文沿用用户输入语言或项目语言。
6. Checker 统一换行后只解析一次 Markdown AST；HTML 注释不算语义内容，代码围栏和 HTML 注释中的 checklist 相似文本不算任务。

### Stage 与受检制品

| 检查场景 | `proposal.md` | `design.md` | `tasks.md` |
| --- | --- | --- | --- |
| Draft 的结构检查 | Draft Proposal 结构 | Design 结构 | 不参与结构检查 |
| Plan 的结构检查、`plan` 命令目标和 archive | Plan Proposal 结构 | Design 结构 | Tasks 结构 |
| Archived Change | Plan Proposal 结构 | Design 结构 | Tasks 结构 |

准备运行 `plan` 时，仍为 Draft 的目录可以包含 `tasks.md`。普通 Draft 检查不校验它，`show`
仍按查询契约返回其可读取内容，`plan` 则按目标 Plan 结构检查它；文件的创建时机和派生关系由
`SKILL.md` 承接。

### Draft Proposal

`proposal.md`：

```markdown
# Proposal

<一句话说明 Change 的方向和 proposal 的临时性质。>

## Why

<当前问题与开展 Change 的理由。>

## Outcome

<完成后可以观察到的结果。>
```

### Design

所有受检场景的 `design.md` 使用同一固定结构：

```markdown
# Design

<一句话说明当前设计方向以及它如何兑现 proposal。>

## Context
<已确认事实、约束和必要假设；事实引用原 owner。>

## Goals / Non-Goals
<设计目标与明确不承担的内容。>

## Decisions
<当前方案、判断状态与影响；明确区分暂定选择和已确认判断。>

## Risks / Trade-offs
<会改变后续设计、实施、权限或验证的风险与取舍。>

## Open Questions
<会改变范围、方案、权限或验收且仍需核对的问题；没有时明确写“无”。>
```

Draft 与 Plan 对 design 内容成熟度的要求、tasks 派生关系和语义审阅由 `SKILL.md` 承接；checker
只验证本节固定结构与非空内容。需要保存只属于当前 Change 的实施观察时，可以在必需序列之后追加
`## Implementation Observations`。

### Plan Proposal 与 Tasks

Plan 及 archived 检查使用扩展后的 `proposal.md` 和完整 `tasks.md`。

`proposal.md`：

```markdown
# Proposal

<一句话说明 Change 的目标和 proposal 的临时计划性质。>

## Why
<当前问题与开展 Change 的理由。>

## Outcome
<完成后可以观察到的结果。>

## Scope
<纳入范围与非目标。>

## Success Criteria
<可检查的完成条件。>

## Affected Owners
<需要读取、修改或验证的稳定 owner。>
```

`tasks.md`：

```markdown
# Tasks

<一句话说明任务顺序和完成出口。>

## Readiness
- [ ] 0.1 <实施前的范围、owner、方案或开放问题审计。>

## Implementation
- [ ] 1.1 <具有明确产物或行为结果的实施任务。>

## Verification
- [ ] 2.1 <能够证明受影响边界的验证任务。>
```

Tasks 规则：

1. 三个必需 H2 各包含至少一项顶层 Markdown checkbox。
2. Checkbox 语法为 `- [ ] <id> <description>` 或 `- [x] <id> <description>`。
3. `<id>` 使用至少两段的层级数字，例如 `0.1`、`1.2` 或 `2.1.1`，并在整个文件内唯一。
4. Checkbox 只能位于 `Readiness`、`Implementation` 或 `Verification`；CLI 分别统计三个区段及整体进度。
5. 任务全部勾选只是机械事实，不表示语义验收或归档授权已经完成。

## Plan Git 距离

Plan 使用 `baseCommit` 到当前 `HEAD` 的 first-parent Git 距离。可用时从基线到当前 `HEAD`
逐个提交统计：

1. Merge revision 的路径与行数变化相对其 first parent 计算。
2. 只修改当前 Change 目录的提交不参与距离。
3. 其他提交计入 `commitCount`；没有路径变化的 first-parent commit 也计入，且为 `changedLines` 增加零。
4. 只累计这些提交在当前 Change 目录之外的 additions 与 deletions，得到 `changedLines`。
5. 二进制变更没有 Git 行数时按零行累计，但所在提交仍计入 `commitCount`。

可用距离的结构化结果只提供 `baseCommit`、`headCommit`、`commitCount` 与 `changedLines`。
文本结果固定为：

- `commitCount` 与 `changedLines` 均为零：`自计划基线以来，未统计到 Change 目录外的项目变化。`
- `commitCount` 非零：`距离计划基线已过去 <commitCount> 个提交，Change 目录外累计变化 <changedLines> 行；继续前请确认这些变化没有影响当前计划。`

可用距离只提示复核，不阻断 `check` 或 `archive`。基线缺失、无法解析、不在当前 `HEAD`
first-parent 历史上、当前仓库没有 `HEAD` 或版本控制操作失败时，检查返回稳定、可行动的阻断诊断；
完成语义复核后重新运行 `plan` 可以刷新基线。

基线缺失、不可解析、不在 first-parent 历史上或仓库没有 `HEAD` 使用
`base-commit-unavailable`；仓库发现、revision 查询或 diff 操作失败使用
`version-control-failed`。两者都使 Plan check 失败；`plan` 可以忽略目标现有 Plan 的这两类基线诊断，
但仍会重新验证当前仓库存在 `HEAD` 后才写入新基线。

## CLI

脚本安装位置与 Change 路径解析基准彼此独立。保持 shell 当前工作目录在目标项目根目录，并用 skill
的实际安装路径调用脚本；以下 `<change-plan-cli>` 表示
`<skill-directory>/scripts/change-plan.mjs`。默认根目录和所有相对路径参数都相对 shell 当前
工作目录解析。

CLI 仅提供以下六个命令：

```text
node <change-plan-cli> list [change-root] [--archived | --all | --stage <draft|plan>] [--json]
node <change-plan-cli> show <change-directory> [--json]
node <change-plan-cli> check <change-directory> [--json]
node <change-plan-cli> check-all [change-root] [--archived | --all] [--json]
node <change-plan-cli> plan <change-directory> [--json]
node <change-plan-cli> archive <change-directory> [--json]
```

### 查询命令

| 命令 | 选择与机械结果 |
| --- | --- |
| `list` | 默认发现当前工作目录 `changes/` 的 active Change；`--archived` 只选 archived，`--all` 选择两者，`--stage` 只筛选 active `draft` 或 `plan`。三个选项互斥。旧版 active metadata 按兼容投影参与 `plan` 筛选。无效成员保持可见，不使发现操作失败。 |
| `show` | 展开一个显式 Change 目录的 status、检查结果和三个 artifacts。结构无效时仍返回可读取内容与诊断，并以领域失败退出。 |
| `check` | 按当前 stage 检查一个显式 Change 目录、metadata、artifacts、任务语法和 Plan 基线。 |
| `check-all` | 默认门禁当前工作目录 `changes/` 的全部 active Change；`--archived` 只选 archived，`--all` 选择两者。根错误或任一成员无效时集合失败；合法空集合通过。 |

`list` 与 `check-all` 只发现 Change 根的直接成员，先按 active、archived 排序，再按 Change 名称
排序。Archived Change 只有在显式选择时进入集合，默认 active 门禁不检查历史 metadata。

### 结构化查询结果

单项 checker 是查询结果的共同内核。`check --json` 直接返回以下字段；`list` entry 和
`show.check` 复用同一结构：

| 字段 | 含义 |
| --- | --- |
| `changeDirectory`、`changeName` | 规范化后的绝对目录与 Change 名称。 |
| `stage`、`metadata` | Active Change 的投影 stage 与可用规范 metadata；archived 的两者均为 `null`，null-base Plan 的 `metadata` 为 `null` 而 `stage` 仍为 `plan`。 |
| `taskCount`、`completedTaskCount`、`taskProgress` | 整体任务计数，以及 readiness、implementation、verification 三个区段各自的计数。 |
| `distance` | 可用 Plan 的 `GitDistanceEvidence`；其他场景为 `null`。 |
| `diagnostics`、`valid` | 稳定诊断数组；仅当数组为空时 `valid` 为 `true`。 |

每个 diagnostic 固定包含 `code`、`file` 和 `message`；定位到 Markdown 行时另外包含 `line`。
`code` 的合法值为：

```text
change-directory-not-found
change-directory-read-failed
change-path-not-directory
duplicate-section
duplicate-task-id
empty-introduction
empty-section
file-read-failed
invalid-change-name
invalid-h1
invalid-metadata
invalid-task-syntax
missing-required-file
missing-section
missing-task
base-commit-unavailable
required-path-not-file
section-order
task-outside-required-section
version-control-failed
```

各查询命令的顶层 JSON 结构为：

1. `show` 返回 `status`、`check` 和 `artifacts`；`artifacts` 固定包含 `proposal.md`、`design.md`、`tasks.md`，不可读的值为 `null`。
2. `list` 返回 `changeRoot`、集合选择 `status`、根级 `errors` 和完整 `entries`；每个 entry 在共同检查结果上增加成员目录 `status`。
3. `check-all` 在 `list` 结果上增加 `checkedCount`、`validCount`、`invalidCount` 与集合 `valid`。集合 `valid` 仅在根级 `errors` 为空且 `invalidCount` 为零时成立。

`list` 和 `check-all` 的顶层 `status` 是集合选择，合法值为 `active`、`archived` 或 `all`；
`entries[].status` 才是单个 Change 的目录 status。

### 写入命令

| 命令 | 源状态与门禁 | 成功结果 |
| --- | --- | --- |
| `plan` | Draft、规范 Plan 或兼容读取识别的旧 active Plan；目标 Plan 的三个 artifacts 结构有效，当前仓库存在 `HEAD`。不以任何 checkbox 进度为门禁。 | 原子写入 `{ "stage": "plan", "baseCommit": "<当前 HEAD>" }`。 |
| `archive` | 结构有效、基线可用且全部 checkbox 已完成的 active Plan。 | 把整个 Change 目录移动到同级 `archive/<change-name>/`，目标存在时不覆盖。 |

两个命令都接受显式 Change 目录，不进行跨根名称搜索。失败时不写入 metadata，也不移动 Change
目录。
`plan` 的现有 Plan 与旧版输入必须先由操作者完成语义复核，刷新基线只记录调用时的
`HEAD`，不证明审阅、实施或授权已经完成。`archive` 在稳定的命名空间前提下，于移动前重验文件系统
身份和目标冲突；它不判断 proposal 成功标准、开放问题、稳定 owner、长期决策、验证证据或归档授权
是否已经完成。

`plan --json` 成功时返回 `success: true`、`action: "plan"`、`fromStage` 和写入后的
`metadata`；失败时返回 `success: false`、`action: "plan"`、`fromStage`、`diagnostics`、
稳定 `errorCode` 和可行动的 `error`。`errorCode` 的合法值为 `artifact-check-failed`、
`base-commit-unavailable`、`invalid-source-stage`、`metadata-write-failed` 与
`version-control-failed`。`archive --json` 始终返回 `sourceDirectory`、
`archiveDirectory`、`archivedDirectory`、`archived`、`check` 与 `error`；成功时 `archived`
为 `true`、`check` 为归档前有效结果且 `error` 为 `null`，失败时保留可用的检查结果和错误说明。

### 退出码与输出

1. `0`：命令成功；`list` 中存在 invalid 成员不使发现操作本身失败；`check-all` 的合法空集合也成功。
2. `1`：查询根或目标不可用、结构或 Plan 基线无效、`check-all` 的任一成员无效、写入或归档门禁失败，或 metadata 与归档写入失败。
3. `2`：CLI 参数无效，包含调用六个命令之外的名称。

文本模式把成功结果写入 stdout，把诊断和失败写入 stderr，并在写入失败中显示稳定 `errorCode`。
`--json` 把成功和领域失败的结构结果写入 stdout；非法参数始终写入 stderr。

### MJS 直接导入边界

`scripts/change-plan.mjs` 可以作为 ESM 直接 import，当前运行时导出 list、show、单项 check、集合
check、plan、archive、metadata 解析与读取以及 CLI runner 对应的底层函数。该能力用于直接复用当前实现，
不建立稳定 SDK：`change-plan.mjs` 不配套生成 `.d.mts`、SDK 声明树或 metadata JSON Schema，也不承诺
导出集合和函数签名跨版本兼容。需要稳定交互时使用本节定义的 CLI 与 JSON 输出；直接 import 的调用方需
随当前实现同步调整。
