# Change Plan 固定结构契约

本文件承接 Change 目录、metadata、artifact 结构与 Git 距离；精确命令契约由 [CLI 契约](cli-contract.md)承接。
内容判断、完成声明、执行流程与授权边界由 [`SKILL.md`](../SKILL.md) 承接。

## 状态模型

当前 Change 的内容 stage 为 `draft` 或 `plan`，生命周期为
`draft -> plan --finalize--> directory absent`。`finalized` 是命令 outcome，退出后的历史由 Git 恢复。
Readiness、Implementation 和 Verification checkbox 记录 Plan 内任务进度；其完成含义与执行义务
见[任务与结项契约](../SKILL.md#任务与结项契约)。

## Change 目录与 metadata

1. 每个 Change 使用独立目录，目录名必须是小写英文、数字和连字符组成的 kebab-case。
2. Change 根目录优先服从目标项目约定；项目没有约定时使用 `changes/`。
3. Change 根目录的直接普通目录表示当前 Change；根下 `.change-plan-tombstones/` 是 finalize 的私有
   清理根，排除在 catalog 的发现、读取与输出范围之外：

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
6. 可以增加交付说明或证据文件。附加文件不替代必需 artifacts，也不参与其结构检查；
   附加目录仍受仓库边界检查约束。
7. Catalog 只发现 Change 根的直接普通目录，并排除 `.change-plan-tombstones`。它不递归发现更深层
   Change，也不把文件或符号链接作为列表成员。
8. `plan` 与 `finalize` 在受信工作区中由单一操作者执行。命令运行期间，目标 Change、Change 根和
   tombstone 路径的命名空间保持稳定；工具拒绝已观察到的符号链接、身份变化和目标冲突，但不把这些
   路径检查当作跨进程锁或恶意并发改名隔离。

### 单一项目仓库边界

Change 根为同一项目保存计划材料，根及其活动真实目录树不支持内嵌 Git 仓库。六个命令在读取
metadata、artifacts、查询 Git 或写入前，先检查完整根；阶段筛选和单项选择都遵守此边界。

检查要求根为可读的普通真实目录，并遍历所有普通子目录，包括附加证据目录；符号链接目录和根下
私有 `.change-plan-tombstones/` 不参与遍历。命令期间保持仓库布局稳定；检查不是跨进程锁。

以下任一标记使检查失败，标记内容无需读取：

- `.git` 成员：目录、gitfile、符号链接或损坏入口均适用。
- 裸仓库布局：同一目录包含非目录 `HEAD` 以及普通目录 `objects/`、`refs/`。

发现标记返回 `change-root-contains-repository`；所需目录无法完整检查时返回
`change-root-read-failed`。失败会阻断整个根的操作：集合返回根级 `errors` 与空 `entries`，单项返回
对应诊断；均以 `1` 退出，不读取 artifacts 或执行写入。集合只检查一次完整根。

### 规范 metadata

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

Metadata 读取和写入遵守同一 schema；不解析或写入符号链接的外部目标。

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
7. HTML 注释不算语义内容，代码围栏和 HTML 注释中的 checklist 相似文本不算任务；换行形式不改变检查语义。

### Stage 与受检制品

| 检查场景 | `proposal.md` | `design.md` | `tasks.md` |
| --- | --- | --- | --- |
| Draft 的结构检查 | Draft Proposal 结构 | Design 结构 | 不参与结构检查 |
| Plan 的结构检查、`plan` 命令目标和 `finalize` | Plan Proposal 结构 | Design 结构 | Tasks 结构 |

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
5. CLI 验证语法并统计声明；工作与验收证据由执行者按[任务与结项契约](../SKILL.md#任务与结项契约)核实。

## Plan Git 距离

需要 Git 证据时，统一使用 Change 根所属的上层项目仓库；普通仓库与 linked worktree 均可。
每个 Change 独立排除自己的目录内变化；Draft 查询和 `list --stage draft` 不调用 Git。

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

可用距离只提示复核，不阻断 `check` 或 `finalize`。基线无法解析、不在当前 `HEAD`
first-parent 历史上、当前仓库没有 `HEAD` 或版本控制操作失败时，检查返回稳定、可行动的阻断诊断；
完成语义复核后重新运行 `plan` 可以刷新基线。

基线不可解析、不在 first-parent 历史上或仓库没有 `HEAD` 使用
`base-commit-unavailable`；仓库发现、revision 查询或 diff 操作失败使用
`version-control-failed`。两者都使 Plan check 失败；`plan` 可以忽略目标现有 Plan 的这两类基线诊断，
但仍会重新验证当前仓库存在 `HEAD` 后才写入新基线。

## CLI

六个命令的路径、参数、查询结果、写入门禁、退出码与直接导入边界见 [CLI 契约](cli-contract.md)。

### 查询命令

`list`、`show`、`check` 和 `check-all` 分别发现成员、读取详情、检查单项和检查集合。选择范围与机械结果见[查询命令](cli-contract.md#查询命令)。

### 结构化查询结果

查询结果包含 Change 身份、stage、任务进度、距离和诊断；集合及详情另有各自字段。完整字段和诊断代码见[结构化查询结果](cli-contract.md#结构化查询结果)。

### 写入命令

`plan` 写入当前 HEAD 基线；`finalize` 必须通过完整 Plan、Git-tree 和身份门禁，先可用 `--preflight` 零写预检。删除和清理不覆盖或误删其他内容；失败按实际 outcome、HEAD 与 tombstone 位置恢复。完整事务和恢复条件见 [写入命令契约](cli-contract.md#写入命令)。

### 退出码与输出

CLI 用退出码区分成功、领域失败和参数错误；文本及 JSON 模式的输出通道不同。具体结果见[退出码与输出](cli-contract.md#退出码与输出)。

### TS 直接导入边界

脚本可作为 ESM 直接导入以复用当前实现，但不提供稳定 SDK 承诺。导出范围与兼容边界见 [TS 直接导入边界](cli-contract.md#ts-直接导入边界)。
