### Case CHANGE-PLAN-ASSESS-ARTIFACTS-001: 计划评估不比较制品与基线内容
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment ignores artifact differences from its base`
- `bun test --test-name-pattern="^assessment ignores artifact differences from its base$" ./tools/change-plan/tests/run.ts`
Contract:
- `baseCommit` 只作为 Git 距离起点，Plan assessment 不把它解释为三个 artifacts 的内容快照。
Proves:
- 工作树修改、只修改 Change 目录的新提交，以及 index 与工作树修改都不触发内容差异复核，评估继续返回 `current` 和 Git 距离证据。
