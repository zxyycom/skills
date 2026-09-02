# Proposal

本 Change 在现有 artifacts 中固定预期调整与衍生影响的因果结构，并让 CLI 承接对应机械门禁。

## Why

当前 Change Plan 已用 `Scope`、`Affected Owners`、design 和 tasks 承接影响范围与处理工作，但集合式范围没有要求保存“预期调整产生衍生影响”的因果次序。预期调整本身可能很小，衍生影响的处理却可能占据大部分篇幅和工作量，导致配套工作反向掩盖主要目的。

各项衍生影响可能需要分别设计、决定和验证，但仍共同服务同一 `Outcome`，并继续共用当前 Change 的生命周期与任务进度。

## Outcome

Change Plan 在 `Scope` 与 `Decisions` 中固定 `Intended Change` 和 `Resulting Impacts`。一个 Change 仍只有一套 proposal、design、tasks、stage、进度和归档结果；CLI 检查结构，skill 继续判断内容关系。

## Scope

### Intended Change

- 调整 `change-plan` 的内容写作与 artifact contract，让预期调整和由它引起的影响在现有 proposal、design 与 tasks 中保持因果关系。
- 为固定 artifact 结构增加 CLI 门禁、生成产物和测试证据。

### Resulting Impacts

- Markdown parser、结构契约、测试 fixture、分发产物与人类说明需要同步。

非目标：不增加影响 ID、子 Change、独立影响状态、额外 artifact 或新的任务进度模型。

## Success Criteria

- 受检 proposal 的 `Scope` 与 design 的 `Decisions` 固定使用 `Intended Change` 和 `Resulting Impacts`，CLI 能报告缺失、重复、空内容和顺序错误。
- Metadata 继续只表达 Draft/Plan stage 和 Plan Git 基线。
- Skill、固定契约、工具源码、分发产物、测试证据和当前 Change 使用同一结构事实。

## Affected Owners

- `skills/change-plan/` 的行为、固定契约与生成 CLI。
- `tools/change-plan/` 的 Markdown 结构、checker 与测试。
- `docs/test-evidence/change-plan/` 的对应原生测试入口 case。
