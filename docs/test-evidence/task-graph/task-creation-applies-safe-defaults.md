### Case TASK-GRAPH-DEFAULTS-001: 顶层默认为 candidate，子任务默认为 inherit，execution 为 idle/attempt 0

Entry:
- `tools/task-graph/tests/schema-index.test.ts > task creation applies safe top-level and child defaults`
- `bun test --test-name-pattern="^task creation applies safe top-level and child defaults$" ./tools/task-graph/tests/run.ts`

Contract:
- 顶层任务、子任务、任务内容中的可选字段、执行状态与关系具有固定安全默认值。

Proves:
- 顶层默认为 candidate，子任务默认为 inherit，execution 为 idle/attempt 0；省略 acceptance 时规范化为稳定空数组。
