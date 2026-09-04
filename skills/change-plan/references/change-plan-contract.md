# Change Plan 固定结构与 CLI 契约

本文件是 Change 目录、`.change-plan.json`、artifact 结构、合法 stage、严格 active metadata、Git
距离和 CLI 机械行为的唯一精确契约。`SKILL.md` 负责 `Outcome`、`Intended Change` 与
`Resulting Impacts` 的内容判断、语义审阅和授权门禁；本文件只固定工具能够确定性执行的边界。

## 状态模型

Change 只有仍在工作区中维护的内容 stage：`draft` 或 `plan`。目录是当前 Change 的唯一成员资格，
成功完成后目录被删除而不是写入 `completed` 或其他持久 status。Readiness、Implementation 和
Verification checkbox 只表达 active Plan 内任务进度。

## Change 目录与 metadata

1. 每个 Change 使用独立目录，目录名必须是小写英文、数字和连字符组成的 kebab-case。
2. Change 根目录优先服从目标项目约定；项目没有约定时使用 `changes/`。
3. Change 根目录的直接普通目录表示当前 Change；根下 `.change-plan-tombstones/` 是 complete 的私有
   清理根，catalog 无条件跳过、不递归、不读取也不输出：

   ```text
   <change-root>/
   ├── <change-name>/
   │   └── .change-plan.json
   └── .change-plan-tombstones/
   ```

4. 当前 Change 及当前检查所需的文件都必须位于真实 Change 目录中并且是普通文件；目录、
   `.change-plan.json` 或 artifact 为符号链接时检查失败且不会跟随链接。
5. 当前 Change 必须包含 `.change-plan.json`。缺失、无法读取、规范字段组合不合法或存在未定义字段时
   检查失败，不投影或自动迁移无效输入。
6. 可以增加交付说明或证据文件；附加文件不参与固定结构检查，也不能代替当前 stage 要求的 artifacts。
7. Catalog 只发现 Change 根的直接普通目录，并排除 `.change-plan-tombstones`。它不递归发现更深层
   Change，也不把文件或符号链接作为列表成员。
8. `plan` 与 `complete` 在受信工作区中由单一操作者执行。命令运行期间，目标 Change、Change 根和
   tombstone 路径的命名空间保持稳定；工具拒绝已观察到的符号链接、身份变化和目标冲突，但不把这些
   路径检查当作跨进程锁或恶意并发改名隔离。

规范 metadata 不包含 schema version，以 `stage` 判别且每个对象只允许对应示例中的字段。
Parser 与 writer 接受以下结构：

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

Active reader、规范 parser 与 writer 使用同一个 runtime schema。读取边界按 lstat、读取、JSON
parse、schema parse 的顺序完成一次校验；writer 在同目录完成整个临时文件后直接发布到 metadata
路径，不解析或写入符号链接的外部目标。Writer 只属于内部持久化边界。Change Plan 不生成 metadata
JSON Schema 或分发类型声明。

## Artifact 结构

### 通用 Markdown 规则

1. 每个受检查的 artifact，其首个非空行必须是唯一 H1，且标题与对应模板完全一致。
2. H1 与首个 H2 之间必须有非空 Change 摘要。
3. 必需 H2 必须各出现一次，并作为文件开头的 H2 序列按模板顺序排列；每节必须有非空语义内容。
4. 必需序列之后可以追加 H2；新增章节不能改变或代替必需章节。
5. 受检 proposal 中出现 `Scope` 时，以及所有受检 design 的 `Decisions` 中，按模板固定 H3。每组必需
   H3 各出现一次，并作为该 H2 内的 H3 起始序列按模板顺序排列；每节必须有非空语义内容，必需序列
   之后可以追加 H3。
6. 固定标题使用英文，正文沿用用户输入语言或项目语言。
7. Checker 统一换行后只解析一次 Markdown AST；HTML 注释不算语义内容，代码围栏和 HTML 注释中的
   checklist 相似文本不算任务。

### Stage 与受检制品

| 检查场景 | `proposal.md` | `design.md` | `tasks.md` |
| --- | --- | --- | --- |
| Draft 的结构检查 | Draft Proposal 结构 | Design 结构 | 不参与结构检查 |
| Plan 的结构检查、`plan` 命令目标和 `complete` | Plan Proposal 结构 | Design 结构 | Tasks 结构 |

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

Draft proposal 不要求 `Scope`；追加 `Scope` 时，该章节仍使用通用 Markdown 规则规定的固定 H3。

### Design

所有受检场景的 `design.md` 使用以下固定结构：

```markdown
# Design

<一句话说明当前设计方向以及它如何兑现 proposal。>

## Context
<已确认事实、约束和必要假设；事实引用原 owner。>

## Goals / Non-Goals
<设计目标与明确不承担的内容。>

## Decisions

### Intended Change
<实现 Outcome 的当前方案与判断状态；明确区分暂定选择和已确认判断。>

### Resulting Impacts
<逐项说明由 Intended Change 引起的影响、局部约束、处理决定与验证要求；没有时明确写“无”。>

## Risks / Trade-offs
<会改变后续设计、实施、权限或验证的风险与取舍。>

## Open Questions
<会改变范围、方案、权限或验收且仍需核对的问题；没有时明确写“无”。>
```

Draft 与 Plan 对 design 内容成熟度的要求、tasks 派生关系和语义审阅由 `SKILL.md` 承接；checker
只验证本节固定结构与非空内容。需要保存只属于当前 Change 的实施观察时，可以在必需序列之后追加
`## Implementation Observations`。

### Plan Proposal 与 Tasks

Plan 检查使用扩展后的 `proposal.md` 和完整 `tasks.md`。

`proposal.md`：

```markdown
# Proposal

<一句话说明 Change 的目标和 proposal 的临时计划性质。>

## Why
<当前问题与开展 Change 的理由。>

## Outcome
<完成后可以观察到的结果。>

## Scope

### Intended Change
<描述为实现 Outcome 采用的预期调整及其范围边界。>

### Resulting Impacts
<逐项说明由 Intended Change 产生且实现 Outcome 必须处理的影响范围；没有时明确写“无”。>

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
5. 任务全部勾选只是机械事实，不表示语义验收或完成授权已经完成。

## Plan Git 距离

Plan 使用 `baseCommit` 到当前 `HEAD` 的 first-parent Git 距离。可用时从基线到当前 `HEAD`
逐个提交统计：

1. Merge revision 的路径与行数变化相对其 first parent 计算。
2. 只修改当前 Change 目录的提交不参与距离。
3. 其他提交计入 `commitCount`；没有路径变化的 first-parent commit 也计入，且为 `changedLines` 增加零。
4. 只累计这些提交在当前 Change 目录之外的 additions 与 deletions，得到 `changedLines`。
5. 二进制变更没有 Git 行数时按零行累计，但所在提交仍计入，且为 `changedLines` 增加零。

可用距离的结构化结果只提供 `baseCommit`、`headCommit`、`commitCount` 与 `changedLines`。
文本结果固定为：

- `commitCount` 与 `changedLines` 均为零：`自计划基线以来，未统计到 Change 目录外的项目变化。`
- `commitCount` 非零：`距离计划基线已过去 <commitCount> 个提交，Change 目录外累计变化 <changedLines> 行；继续前请确认这些变化没有影响当前计划。`

可用距离只提示复核，不阻断 `check` 或 `complete`。基线无法解析、不在当前 `HEAD`
first-parent 历史上、当前仓库没有 `HEAD` 或版本控制操作失败时，检查返回稳定、可行动的阻断诊断；
完成语义复核后重新运行 `plan` 可以刷新基线。

基线不可解析、不在 first-parent 历史上或仓库没有 `HEAD` 使用
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
node <change-plan-cli> list [change-root] [--stage <draft|plan>] [--json]
node <change-plan-cli> show <change-directory> [--json]
node <change-plan-cli> check <change-directory> [--json]
node <change-plan-cli> check-all [change-root] [--json]
node <change-plan-cli> plan <change-directory> [--json]
node <change-plan-cli> complete <change-directory> [--preflight] [--json]
```

### 查询命令

| 命令 | 选择与机械结果 |
| --- | --- |
| `list` | 发现当前工作目录 `changes/` 或显式根目录的直接 Change 成员；`--stage` 只筛选规范 `draft` 或 `plan`。无效成员保持可见但没有合法 stage，不使发现操作失败。 |
| `show` | 返回当前 Change 的检查结果和可读取 artifacts；结构无效时以领域失败退出。 |
| `check` | 按当前 stage 检查一个显式 Change 的 metadata、artifacts、任务语法和 Plan 基线。 |
| `check-all` | 门禁当前工作目录 `changes/` 或显式 change root 的全部直接成员。根错误或任一成员无效时集合失败；合法空集合通过。 |

`list` 与 `check-all` 只发现 Change 根的直接成员，按 Change 名称排序；`.change-plan-tombstones`
始终忽略。

`show`、`check`、`plan` 与 `complete` 的显式目录必须是项目约定 Change 根（未约定时
`changes/`）的直接 active member。单目录命令从目标父目录推导该根，不进行跨根名称搜索；目标父目录
或任一祖先是另一个 Change 的 metadata 边界时视为嵌套路径。`.change-plan-tombstones` 及其 child
和任何嵌套路径都返回
`change-directory-not-active-member`，不会读取或写入其内容。

### 结构化查询结果

单项 checker 结果由 `check --json` 直接返回；`list` entry 和 `show.check` 复用同一结构：

| 字段 | 含义 |
| --- | --- |
| `changeDirectory`、`changeName` | 规范化后的绝对目录与 Change 名称。 |
| `stage`、`metadata` | 规范 Change 的 stage 与 metadata；metadata 无效时两者均为 `null`。 |
| `taskCount`、`completedTaskCount`、`taskProgress` | 整体任务计数，以及 readiness、implementation、verification 三个区段各自的计数。 |
| `distance` | 可用 Plan 的 `GitDistanceEvidence`；其他场景为 `null`。 |
| `diagnostics`、`valid` | 稳定诊断数组；仅当数组为空时 `valid` 为 `true`。 |

每个 diagnostic 固定包含 `code`、`file` 和 `message`；定位到 Markdown 行时另外包含 `line`。
`code` 的合法值为：

```text
change-directory-not-active-member
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

`show` 返回 `changeDirectory`、`changeName`、完整 `check` 和 `artifacts`。`artifacts` 固定包含
`proposal.md`、`design.md`、`tasks.md`；缺失、非普通文件或不可读的值为 `null`。`list` 返回
`changeRoot`、根级 `errors` 与 `entries`；`check-all` 返回 `entries`、`changeRoot`、根级 `errors`、
`checkedCount`、`validCount`、`invalidCount` 与集合 `valid`。

### 写入命令

| 命令 | 源状态与门禁 | 成功结果 |
| --- | --- | --- |
| `plan` | 规范 Draft 或 Plan；目标 Plan 的三个 artifacts 结构有效，当前仓库存在 `HEAD`。不以任何 checkbox 进度为门禁。 | 原子写入 `{ "stage": "plan", "baseCommit": "<当前 HEAD>" }`。 |
| `complete` | 结构有效、基线可用且全部 checkbox 已完成的 Plan；完整 physical tree 必须与当前 `HEAD` 的同一路径 Git tree 精确匹配。 | 删除 Change 目录；或在 cleanup 无法证明完成时保留 tombstone child。 |

两个命令都接受显式直接 active Change 目录，并从目标父目录推导项目约定根，不进行跨根名称搜索。
`plan` 的现有 Plan 必须先由操作者完成语义复核，刷新基线只记录调用时的 `HEAD`，不证明审阅、实施或授权已经完成。

`complete --preflight` 执行与实际删除相同的 Plan、任务、Git-tree、同设备、tombstone target 和
identity 准备，但零写入且不保存 receipt。实际 complete 先在 Change root 下创建私有
`.change-plan-tombstones`（如尚不存在），再重新读取完整 Plan/任务/base/HEAD 门禁并重新准备；两次
lifecycle 与 HEAD snapshot 必须一致。声明 tombstone child 前重验 root/source/tombstone identity、当前
`HEAD`、完整 physical member 和 target absence。它只接受 Git regular file mode `100644`、
`100755`，并要求每个 physical file 的字节及 owner executable bit 一致；symlink、submodule、特殊
文件、空/未知目录、已修改、未跟踪或忽略成员都被拒绝。target 以独占目录声明，逐项以不覆盖复制建立
验证快照；POSIX `rename()` 不作为 no-overwrite 目录移动原语。只在复制快照与 source 均仍精确匹配后，
才 unlink 已预演 files，再从深到浅 `rmdir` 已预演目录，绝不递归删除。任何并发 target 或成员漂移都不
覆盖、不删除外来内容。

`complete --json` 始终返回 `sourceDirectory`、`check`、`changed`、`outcome`、`headCommit`、
`memberCount`、`tombstoneDirectory` 与 `error`。`outcome` 为：

- `preflight`：所有门禁和删除准备通过，未写入。
- `no-change`：任一门禁、准备、重验或 source 删除未提交，`changed: false`。若独占 target 已出现外来
  内容，`tombstoneDirectory` 指向只可人工检查的未提交声明路径。
- `completed`：已验证复制且 source 与 tombstone 都已精确清理，`changed: true`、`tombstoneDirectory: null`。
- `committed-cleanup-pending`：已建立可验证 tombstone 副本，但 source 或 tombstone 的精确清理无法完成，
  `changed: true`，`tombstoneDirectory` 是
  唯一可操作的恢复位置。

complete 不 stage、commit、reset、revert 或自动 Git restore；`headCommit` 是维护者可用普通 Git
恢复 source 的 revision。source 删除前失败不删除 source 成员；建立验证副本后失败不是 rollback 或完成，
维护者只可检查报告的 tombstone child，或从报告的 `HEAD` 用普通 Git 恢复。

### 退出码与输出

1. `0`：查询成功；`list` 中存在 invalid 成员不使发现操作失败；`check-all` 的合法空集合也成功；
   `complete` 的 `preflight`、`completed` 或 `committed-cleanup-pending` 也成功并在文本中明确 outcome。
2. `1`：查询根或目标不可用、结构或 Plan 基线无效、`check-all` 的任一成员无效，或 `plan` / `complete`
   的领域门禁、准备、重验或写入失败。
3. `2`：CLI 参数无效，包含调用六个命令之外的名称、`--archived` 或 `--all`。

文本模式把成功结果写入 stdout，把诊断和失败写入 stderr。`committed-cleanup-pending` 在 stdout 明确输出
outcome、source、HEAD recovery revision、member count 与 precise tombstone，并在 stderr 输出 cleanup
diagnostic；JSON 保留同一结构并以 0 退出。
`--json` 把成功和领域失败的结构结果写入 stdout；非法参数始终写入 stderr。

### MJS 直接导入边界

`scripts/change-plan.mjs` 可以作为 ESM 直接 import，当前运行时导出 list、show、单项 check、集合
check、plan、complete、metadata 解析与读取以及 CLI runner 对应的底层函数。该能力用于直接复用当前
实现，不建立稳定 SDK：`change-plan.mjs` 不配套生成 `.d.mts`、SDK 声明树或 metadata JSON Schema，
也不承诺导出集合和函数签名跨版本兼容。需要稳定交互时使用本节定义的 CLI 与 JSON 输出；直接 import
的调用方需随当前实现同步调整。
