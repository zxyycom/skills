### Case TASK-GRAPH-PROJECTION-001: 候选、等待、暂停、恢复和终态不进入 actionable，ready task 返回正确 nextAction

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > effective-state priority and actionable distinguish leaf claim from parent complete`
- `bun test --test-name-pattern="^effective-state priority and actionable distinguish leaf claim from parent complete$" ./tools/task-graph/tests/run.ts`

Contract:
- effective state 使用固定优先级，actionable 只包含 ready task 并区分叶子 claim 与父任务 complete。

Proves:
- 候选、等待、暂停、恢复和终态不进入 actionable，ready task 返回正确 nextAction。
