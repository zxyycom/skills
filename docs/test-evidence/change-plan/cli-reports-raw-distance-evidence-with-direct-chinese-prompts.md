### Case CHANGE-PLAN-CLI-DISTANCE-001: CLI 返回原始距离证据与直接中文提示
Entry:
- `tools/change-plan/tests/cli.test.ts > CLI reports raw distance evidence with direct Chinese prompts`
- `bun test --test-name-pattern="^CLI reports raw distance evidence with direct Chinese prompts$" ./tools/change-plan/tests/run.ts`

Contract:
- Plan 查询的文本模式从 Git 距离证据生成直接中文行动提示；`commitCount` 与 `changedLines` 均为零表示自基线后没有纳入距离的 Change 目录外变化，不表示 `baseCommit` 与 `headCommit` 相等。JSON 模式在 `distance` 中返回固定四字段原始证据。

Proves:
- 基线处和仅提交 Change 目录内文件后，文本都输出“自计划基线以来，未统计到 Change 目录外的项目变化。”
- Change-only 提交后的 JSON 保持 `commitCount: 0`、`changedLines: 0`，同时 `baseCommit` 与 `headCommit` 不同。
- 非零距离文本直接报告提交数、Change 外变化行数和复核行动。
- JSON `distance` 恰好由 `baseCommit`、`headCommit`、`commitCount` 与 `changedLines` 表达零距离和非零距离。
