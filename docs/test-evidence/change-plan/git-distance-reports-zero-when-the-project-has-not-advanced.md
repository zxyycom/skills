### Case CHANGE-PLAN-GIT-ZERO-001: 项目未推进时 Git 距离为零
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance-v1 reports zero distance when the project has not advanced`
- `bun test --test-name-pattern="^git-distance-v1 reports zero distance when the project has not advanced$" ./tools/change-plan/tests/run.ts`
Contract:
- HEAD 未越过计划基线时，`git-distance-v1` 必须报告零距离并保持当前状态。
Proves:
- 基线等于 HEAD 时提交数和变更行数均为 0，评估结果为 `current`。
