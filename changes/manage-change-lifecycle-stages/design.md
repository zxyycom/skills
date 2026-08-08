# Design

本设计把 active Change 的阶段、确认计划的 Git 基线和固定项目演进距离组合成一条可执行生命周期，使工具能够发现并转换已经搁置的 plan。

## Context

- 建立本 change 时，[`change-plan` 行为入口](../../skills/change-plan/SKILL.md) 和 [`固定契约`](../../skills/change-plan/references/change-plan-contract.md) 只实现 `active | archived`、完整三文件以及 `list`、`show`、`check`、`archive`。
- [`按生命周期阶段维护 Change`](../../docs/decisions/change-plan/manage-change-lifecycle-stages.md) 已确认 `draft -> plan -> implementation`、`plan -> shelved -> plan` 和禁止 `shelved -> implementation` 的方向，但尚未与当前事实对齐。
- Git 距离代替时间、查询只发现候选且只有显式命令才写入 shelved 的理由，由独立的[机械搁置候选决策](../../docs/decisions/change-plan/detect-shelved-plans-by-git-distance.md)承接；其中 `reconcile` 保存机械证据，`shelve --reason` 保存明确原因。实现与验证成为事实后再以 aligned 激活。
- 本 change 使用 `.change-plan.json` 保存 active 阶段，并以同一固定规则评估所有 plan。
- active catalog、Change 进度和 Git HEAD 属于实施时事实，迁移时必须重新读取。

本文记录本 change 的实施设计；完成实现、迁移、行为 owner 和验证后，既有阶段决策才标记为 aligned，机械搁置候选才以 aligned 激活。

## Goals / Non-Goals

目标：

- 让 active Change 从 draft 逐步收敛到 plan 和 implementation，并能保存 shelved 状态。
- 用 Git 提交数和累计 diff 行数稳定识别搁置候选。
- 让查询负责发现，阶段命令负责写入，恢复后的 plan 必须重新确认。
- 一次性迁移 active Change 后只维护一套元数据协议。

非目标：

- 建立可配置评分系统、每 Change policy 或后台自动写入。
- 判断 implementation 中途是否搁置。
- 改变 archived Change 的历史结构。

## Decisions

### 1. status、stage 和 assessment 分别表达不同事实

| 概念 | 合法值 | 含义 |
| --- | --- | --- |
| status | `active`、`archived` | 由目录位置决定。 |
| stage | `draft`、`plan`、`implementation`、`shelved` | 只适用于 active Change，由 `.change-plan.json` 决定。 |
| assessment | `not-applicable`、`current`、`shelve-candidate`、`plan-review-required` | 查询得到的 plan 状态，不是可直接写入的 stage。 |

`shelve-candidate` 表示 plan 已经命中固定规则，查询本身不改变 stage。执行 `reconcile` 会以 Git 距离证据进入 `shelved`，执行 `shelve --reason` 会以明确原因进入 `shelved`。Archived Change 没有 active stage，assessment 为 `not-applicable`。

### 2. `.change-plan.json` 保存当前阶段所需的最小事实

元数据直接使用 `stage` 判别联合，不包含 schema version：

```ts
type ChangePlanMetadata =
  | { stage: "draft" }
  | { stage: "plan"; baseCommit: string | null }
  | { stage: "implementation"; baseCommit: string }
  | {
      stage: "shelved";
      baseCommit: string;
      shelf:
        | { source: "explicit"; atCommit: string; reason: string }
        | {
            source: "git-distance-v1";
            atCommit: string;
            commitCount: number;
            changedLines: number;
          };
    };
```

`baseCommit` 表示最后一次确认 artifacts 可用于继续工作的 Git commit。正常推进时由 plan 传给 implementation 或 shelved；既有 implementation 迁移时使用迁移审阅确认的 snapshot。`plan.baseCommit: null` 只表示 shelved 恢复后尚未重新确认。

Active Change 必须使用与 stage 对应的字段组合。显式搁置要求非空 reason；机械搁置保存判定时的 commit 数和累计行数。元数据只保存当前状态，不维护完整事件历史。

实现以严格 Valibot 判别 schema 作为运行时类型与校验来源。Revision 不含空白，reason 首尾没有空白，距离值为非负安全整数；读取与内部写入使用同一 schema。`change-plan.mjs` 不配套生成 metadata JSON Schema、`.d.mts` 或 SDK 声明树。

### 3. artifact 门禁随阶段增加

| Stage | 内容要求 | 推进条件 |
| --- | --- | --- |
| `draft` | metadata 和最小 proposal | 方向与必要背景已经可识别。 |
| `plan` | metadata 和完整 proposal、design、tasks | Readiness 全部勾选，Implementation 与 Verification 没有已勾选项，artifacts 已提交。 |
| `implementation` | metadata 和完整三文件 | 由 current plan 进入并沿用其 `baseCommit`。 |
| `shelved` | metadata 和完整三文件 | 由尚未实施的 plan 显式搁置或机械转换。 |

Draft proposal 只要求 `# Proposal`、摘要、`## Why` 和 `## Outcome`。进入 plan 后使用当前完整三文件契约。

计划确认后，proposal、design 或 tasks 偏离 `baseCommit` 时 assessment 为 `plan-review-required`。重新完成审阅、提交 artifacts 并执行 `plan` 后，才能更新基线。

### 4. 专职命令推进阶段

| 命令 | 源状态 | 成功结果 |
| --- | --- | --- |
| `plan` | draft、`plan-review-required` 或 `shelve-candidate` 的 plan | 确认完整 artifacts，把当前 HEAD 写入 `baseCommit`，得到 current plan。 |
| `implement` | current plan | 进入 implementation。 |
| `shelve --reason` | current 或 shelve-candidate plan | 保存明确暂停原因并进入 shelved。 |
| `reconcile` | shelve-candidate | 保存 Git 距离证据并进入 shelved。 |
| `resume` | shelved | 回到 `baseCommit: null` 的待复核 plan。 |
| `archive` | implementation | 通过既有完成门禁后移入 archive。 |

CLI 语法：

```text
node <change-plan-cli> plan <change-directory> [--json]
node <change-plan-cli> implement <change-directory> [--json]
node <change-plan-cli> shelve <change-directory> --reason <text> [--json]
node <change-plan-cli> reconcile <change-directory> [--json]
node <change-plan-cli> resume <change-directory> [--json]
```

`shelved` 只能先 resume 回到 plan，不能直接 implement。`implement` 在执行时重新评估 plan，候选必须先 shelve 或重新确认。

### 5. `git-distance-v1` 使用确认计划后的项目演进距离

`plan` 命令要求完整 artifacts 已提交且与当前 HEAD 一致，然后把 HEAD 保存为 `baseCommit`。评估 plan 时先确认基线仍可读取、位于当前 HEAD 的 first-parent 历史中，且三个 artifacts 仍与基线一致；无法确认时返回 `plan-review-required`。

[`tools/shared/version-control`](../../tools/shared/version-control.md) 以独立的 `listFirstParentRevisionChanges(repository, options)` 操作负责领域无关的 first-parent revision 枚举，并承接 numstat 解析、仓库相对路径和稳定错误映射；该操作不扩张仓库对象接口。Change Plan 只负责排除当前 Change 路径、聚合提交数与变更行数，并应用 `git-distance-v1` 阈值；不在领域实现中重复解析 Git 输出。

从 `baseCommit` 到 HEAD 沿 first-parent 统计：

1. 只修改当前 change 目录的提交不参与距离。
2. 其他 first-parent 提交计入 `commitCount`，包括没有路径变化的提交。
3. 这些提交在当前 change 目录之外的 additions 加 deletions 累计为 `changedLines`。

二进制变更没有行数时按零行累计，但其所在的项目提交仍计入 `commitCount`。Git 操作本身失败时 assessment 不可用并报告稳定故障；可查询但不在 first-parent 上的基线才是 `plan-review-required` 的 `base-unavailable`。

固定规则：

- `commitCount > 3 && changedLines > 1000`：成为候选。
- `commitCount >= 9`：成为候选。
- `changedLines >= 3000`：成为候选。
- 其余情况：保持 current。

项目没有新提交时结果始终是 current。规则属于 `git-distance-v1` 固定契约，不进入单个 Change 或项目配置。

### 6. 查询提供紧凑结果，写入由显式命令完成

`list` 为 active 条目增加 stage 和 assessment，并支持：

```text
node <change-plan-cli> list [change-root] [--archived | --all | --stage <stage>] [--json]
```

候选条目的普通输出只增加一条摘要，例如 `shelve-candidate: 5 commits / 1524 changed lines since plan`。`show` 和 CLI JSON 输出提供 `policy`、`baseCommit`、`headCommit`、`commitCount` 与 `changedLines`，用于复核和自动化。

发现候选不会让 `list`、`show` 或 `check` 失败，但 `implement` 会拒绝候选。候选复核后仍准备实施时运行 `plan` 更新基线；接受机械搁置判定时运行 `reconcile`。结构、metadata 或计划基线无效时继续使用退出码 `1`；成功为 `0`，参数错误为 `2`。

### 7. MJS 允许直接调用当前运行时但不建立 SDK

构建器只生成自包含 `change-plan.mjs` 及 source map。MJS 保留来自运行时入口的当前查询、阶段、archive、metadata 解析与 CLI runner 函数，使需要底层复用的调用方可以直接 import；这些导出属于实现表面，不承诺稳定签名或跨版本兼容，也不生成类型声明树。稳定自动化入口仍是 CLI 及其文本和 JSON 契约。

### 8. active Change 一次性迁移到新协议

实施时重新读取 active catalog，并逐项确认阶段：

- Implementation 或 Verification 已经开始：迁移为 `implementation`。
- Readiness 已完成且实施尚未开始：迁移为 `plan`。
- 其余：迁移为 `draft`。

任务进度只提供阶段候选，最终结果以实际 Change 内容和工作状态为准。Plan 和 implementation 使用迁移前已提交并经过审阅的 HEAD snapshot 作为 `baseCommit`。迁移包含本 change；历史 archived Change 不补写元数据。

全部 active Change 写入元数据并通过 catalog 检查后，新 checker 只接受新协议。

## Risks / Trade-offs

- 提交数和 diff 行数是项目演进的统一信号，不证明具体计划已经失效；因此规则先产生候选，恢复时仍要求重新审阅。
- First-parent 让结果稳定，但 merge 和 squash 方式会影响提交数；累计行数提供另一条固定信号。
- 新协议会一次性改变全部 active Change；迁移和实现必须在同一交付中完成。

## Open Questions

无。
