# Change Plan 固定结构与生命周期契约

本文件是 change 目录、`.change-plan.json`、artifact 结构、阶段转换、assessment、Git 距离和 CLI 机械行为的唯一精确契约。`SKILL.md` 负责内容写作、语义审阅和授权门禁；本文件只固定工具能够确定性执行的边界。

## 状态模型

Change 使用三个互不替代的概念：

| 概念 | 合法值 | 事实来源 |
| --- | --- | --- |
| status | `active`、`archived` | Change 所在目录。 |
| stage | `draft`、`plan`、`implementation`、`shelved` | Active Change 的 `.change-plan.json`；archived Change 没有 stage。 |
| assessment | `not-applicable`、`current`、`shelve-candidate`、`plan-review-required` | 对当前 Change 和 Git 仓库的查询结果，不是可写入的 stage；版本控制查询失败时结果为 `null` 并附带诊断。 |

Active stage 的标准路径是 `draft -> plan -> implementation`。随后执行 `archive` 会把目录 status 从 `active` 改为 `archived`，归档不是第五个 stage。计划可以通过 `plan -> shelved -> plan` 暂停和恢复；`shelved -> implementation` 非法。

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

4. Active Change 及当前 stage 要求的文件都必须位于真实 Change 目录中并且是普通文件；目录、`.change-plan.json` 或 artifact 为符号链接时检查失败且不会跟随链接。
5. Active Change 必须包含 `.change-plan.json`。缺失、无法读取、字段组合不合法或存在未定义字段时检查失败。
6. Archived Change 保留完整三 artifacts；归档时随目录保留的 `.change-plan.json` 只作为历史文件，checker 不要求、读取或解释它，stage 和 assessment 分别为 `null` 与 `not-applicable`。
7. 可以增加交付说明或证据文件；附加文件不参与固定结构检查，也不能代替当前 stage 要求的 artifacts。
8. Catalog 只发现上述两层普通目录，不递归发现更深层 Change，也不把文件或符号链接作为列表成员。

`.change-plan.json` 直接使用 `stage` 判别联合，不包含 schema version。每个对象只允许对应示例中的字段。

Draft：

```json
{
  "stage": "draft"
}
```

已确认或待复核的 plan：

```json
{
  "stage": "plan",
  "baseCommit": "<plan-baseline-commit>"
}
```

`baseCommit` 为非空字符串时表示最后一次成功运行 `plan` 时读取的 `HEAD`，只作为后续 Git 距离的起点。Artifacts 的工作树、index 和提交内容不参与设置或评估该基线。Shelved Change 执行 `resume` 后该字段为 `null`，表示尚待重新记录基线。

Implementation：

```json
{
  "stage": "implementation",
  "baseCommit": "<plan-baseline-commit>"
}
```

显式 shelved：

```json
{
  "stage": "shelved",
  "baseCommit": "<plan-baseline-commit>",
  "shelf": {
    "source": "explicit",
    "atCommit": "<head-commit>",
    "reason": "<non-empty-reason>"
  }
}
```

机械 shelved：

```json
{
  "stage": "shelved",
  "baseCommit": "<plan-baseline-commit>",
  "shelf": {
    "source": "git-distance-v1",
    "atCommit": "<head-commit>",
    "commitCount": 5,
    "changedLines": 1524
  }
}
```

`baseCommit` 与 `atCommit` 必须是非空且不含空白的字符串；`reason` 必须非空且首尾没有空白；`commitCount` 和 `changedLines` 必须是非负安全整数。Metadata 只保存当前阶段所需事实，不保存事件历史。

Valibot schema 是运行时 metadata 类型与校验的实现来源。Change Plan 不为 metadata 生成 JSON Schema 或分发类型声明。读取边界按 lstat、读取、JSON parse、schema parse 的顺序完成一次校验；生命周期 writer 使用同一运行时 schema，且只属于内部持久化边界。

## Artifact 结构

### 通用 Markdown 规则

1. 每个受当前 stage 检查的 artifact，其首个非空行必须是唯一 H1，且标题与对应模板完全一致。
2. H1 与首个 H2 之间必须有非空 Change 摘要。
3. 必需 H2 必须各出现一次，并作为文件开头的 H2 序列按模板顺序排列；每节必须有非空语义内容。
4. 必需序列之后可以追加 H2；新增章节不能改变或代替必需章节。
5. 固定标题使用英文，正文沿用用户输入语言或项目语言。
6. Checker 统一换行后只解析一次 Markdown AST；HTML 注释不算语义内容，代码围栏和 HTML 注释中的 checklist 相似文本不算任务。

### 阶段与受检制品

| 检查场景 | `proposal.md` | `design.md` | `tasks.md` |
| --- | --- | --- | --- |
| 当前 stage 为 `draft` 时的结构检查 | 使用 Draft Proposal 结构。 | 使用 Design 结构。 | 不参与结构检查。 |
| `plan` 命令的目标结构 | 使用 Plan Proposal 结构。 | 使用 Design 结构。 | 使用 Tasks 结构。 |
| `plan`、`implementation` 或 `shelved` 阶段，以及 archived Change | 使用 Plan Proposal 结构。 | 使用 Design 结构。 | 使用 Tasks 结构。 |

准备运行 `plan` 时，metadata 仍为 `draft` 的过渡目录可以包含 `tasks.md`。普通 Draft 结构检查不校验它，`show` 仍按查询契约返回其可读取内容，`plan` 命令则按目标结构检查它；文件的创建时机和派生关系由 `SKILL.md` 承接。

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

Draft 与 Plan 对 design 内容成熟度的要求、tasks 派生关系和语义审阅由 `SKILL.md` 承接；checker 只验证本节固定结构与非空内容。

需要保存只属于当前 Change 的实施观察时，可以在 `design.md` 的必需序列之后追加 `## Implementation Observations`。

### Plan Proposal 与 Tasks

Plan 及后续检查场景使用扩展后的 `proposal.md` 和完整 `tasks.md`。

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

## Plan assessment 与 Git 距离

1. Archived Change 和 stage 不是 `plan` 的 active Change 使用 `not-applicable`。
2. Plan 的 `baseCommit` 为 `null`、不能解析或不是当前 `HEAD` 的 first-parent 祖先时，assessment 为 `plan-review-required`；`check` 同时失败。Artifacts 的工作树、index 和提交内容不参与 assessment。
3. 可评估的 plan 使用固定 `git-distance-v1`。从 `baseCommit` 到当前 `HEAD` 沿 first-parent 逐个提交统计：
   - Merge revision 的路径与行数变化相对其 first parent 计算。
   - 只修改当前 Change 目录的提交不参与距离。
   - 其他提交计入 `commitCount`；没有路径变化的 first-parent commit 也计入，且为 `changedLines` 增加零。
   - 只累计这些提交在当前 Change 目录之外的 additions 与 deletions，得到 `changedLines`。
   - 二进制变更没有 Git 行数时按零行累计，但所在提交仍计入 `commitCount`。
4. 以下任一条件成立时 assessment 为 `shelve-candidate`：
   - `commitCount > 3 && changedLines > 1000`
   - `commitCount >= 9`
   - `changedLines >= 3000`
5. 其余可评估 plan 为 `current`。`3/1000` 保持 current；项目没有新提交或只有当前 Change 目录发生变化时距离为 `0/0`。
6. Assessment 不使用日期或文件 mtime，也没有项目级或单 Change 阈值。`shelve-candidate` 本身不使 `check` 失败；查询只报告候选，复核后可以重新运行 `plan` 更新基线。`reconcile` 以 `git-distance-v1` 证据把候选写成 shelved；`shelve --reason` 则以明确原因写入 shelved。
7. Git 仓库发现、revision 查询或 diff 操作失败时，assessment 为 `null`，`check` 使用 `version-control-failed` 诊断并失败；这类操作故障不转换成 `plan-review-required`。可解析但不在 HEAD first-parent 上的基线仍是 `base-unavailable`。

## CLI

脚本安装位置与 Change 路径解析基准彼此独立。保持 shell 当前工作目录在目标项目根目录，并用 skill 的实际安装路径调用脚本；以下 `<change-plan-cli>` 表示 `<skill-directory>/scripts/change-plan.mjs`。默认根目录和所有相对路径参数都相对 shell 当前工作目录解析。

```text
node <change-plan-cli> list [change-root] [--archived | --all | --stage <stage>] [--json]
node <change-plan-cli> show <change-directory> [--json]
node <change-plan-cli> check <change-directory> [--json]
node <change-plan-cli> plan <change-directory> [--json]
node <change-plan-cli> implement <change-directory> [--json]
node <change-plan-cli> shelve <change-directory> --reason <text> [--json]
node <change-plan-cli> reconcile <change-directory> [--json]
node <change-plan-cli> resume <change-directory> [--json]
node <change-plan-cli> archive <change-directory> [--json]
```

### 查询命令

1. `list` 默认列出当前工作目录 `changes/` 下的 active Change；`--archived` 只列历史，`--all` 先列 active 再列 archived，`--stage` 只筛选一个 active stage。三个选项互斥。
2. `list` 每个条目包含 status、stage、assessment、绝对目录、结构有效性和任务进度。无效成员仍列出；Change 根或目标生命周期目录不可查询时命令失败。
3. `show` 接受显式 Change 目录，返回 status、stage、assessment、检查结果和三个 artifacts；可评估 plan 同时报告 policy、基线、HEAD、提交数与变更行数。结构无效时仍返回可读取内容和诊断，但命令失败。
4. `check` 按当前 stage 检查目录、metadata、artifacts、任务语法和 plan assessment。文本模式输出结果或诊断；`--json` 返回完整结构结果。

### 阶段命令

| 命令 | 源状态与门禁 | 成功结果 |
| --- | --- | --- |
| `plan` | `draft`，或 assessment 为 `plan-review-required`、`shelve-candidate` 的 `plan`；完整三 artifacts 有效，Readiness checkbox 全部勾选，Implementation 与 Verification 没有已勾选 checkbox；版本控制门禁只要求当前仓库存在 `HEAD`。 | 写入 stage `plan` 和命令运行时的 `HEAD` 作为 `baseCommit`。 |
| `implement` | Assessment 为 `current` 的已确认 plan。 | 沿用 `baseCommit` 并写入 stage `implementation`。 |
| `shelve --reason` | Assessment 为 `current` 或 `shelve-candidate` 的已确认 plan，reason 非空。 | 写入 stage `shelved`、原因和当前 `HEAD`。 |
| `reconcile` | Assessment 为 `shelve-candidate` 的 plan。 | 写入 stage `shelved`、`git-distance-v1` 证据和当前 `HEAD`。 |
| `resume` | 结构有效的 shelved Change。 | 写入 stage `plan` 和 `baseCommit: null`，等待重新审阅与 `plan`。 |

阶段命令接受显式 Change 目录，不进行跨根名称搜索。失败时不写入目标 metadata。成功结果固定包含 `success: true`、`action`、`fromStage` 和写入后的 `metadata`；失败结果固定包含 `success: false`、`action`、`fromStage`、`diagnostics`、稳定 `errorCode` 和可行动的 `error`。结果不嵌入更新后的 check、assessment 或 Change 路径。

`resume` 成功以返回且已写入的 metadata 为 `stage: "plan"`、`baseCommit: null` 为准。后续必须重新审阅并运行 `plan`；artifacts 与更新后的 metadata 可以随后进入同一个提交。需要查看更新后的 assessment 时另行执行 `show` 或 `check`。

### Archive

1. `archive` 只接受显式 active Change 目录。目标必须通过当前检查、处于 `implementation` 且全部 checkbox 已完成。
2. 成功时把整个 Change 目录移动到同级 `archive/<change-name>/`，保留 metadata、三个 artifacts 与全部附加文件；目标已存在时不覆盖。
3. CLI 不判断 proposal 成功标准、开放问题、稳定 owner、长期决策、验证证据或归档授权是否已经完成。

### 退出码与输出

1. `0`：命令成功；`list` 中存在 invalid 成员不使发现操作本身失败。
2. `1`：查询根或目标不可用、结构或 assessment 无效、阶段门禁失败，或 metadata 与归档写入失败。
3. `2`：CLI 参数无效。

文本模式把成功结果写入 stdout，把诊断和失败写入 stderr，并在生命周期失败中显示 `errorCode`。`--json` 把成功和领域失败的结构结果写入 stdout；非法参数始终写入 stderr。

### MJS 直接导入边界

`scripts/change-plan.mjs` 可以作为 ESM 直接 import，当前运行时导出 list、show、check、archive、五个阶段命令、metadata 解析与读取以及 CLI runner 对应的底层函数。该能力用于直接复用当前实现，不建立稳定 SDK：`change-plan.mjs` 不配套生成 `.d.mts`、SDK 声明树或 metadata JSON Schema，也不承诺导出集合和函数签名跨版本兼容。需要稳定交互时使用本节定义的 CLI 与 JSON 输出；直接 import 的调用方需随当前实现同步调整。
