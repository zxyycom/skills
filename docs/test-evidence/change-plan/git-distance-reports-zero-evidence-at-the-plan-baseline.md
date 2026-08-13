### Case CHANGE-PLAN-GIT-ZERO-001: Git 距离在基线处返回零证据
Entry:
- `tools/change-plan/tests/git-distance.test.ts > git-distance reports zero evidence at the plan baseline`
- `bun test --test-name-pattern="^git-distance reports zero evidence at the plan baseline$" ./tools/change-plan/tests/run.ts`

Contract:
- 当前 HEAD 等于 Plan 基线时返回完整的零距离 measured evidence。

Proves:
- commitCount 与 changedLines 都为零，baseCommit 与 headCommit 相同。
