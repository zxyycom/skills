### Case TASK-GRAPH-DEFAULTS-001: 顶层默认为 candidate，子任务默认为 inherit，execution 为 idle/attempt 0

Tests:
- `test:356f309bd85c19af1dfd2729c08467d94438aa8552b857ab49145182910c0d04`

Tags:
- `task-graph`

Contract:
- 顶层任务、子任务、任务内容中的可选字段、执行状态与关系具有固定安全默认值。

Proves:
- 顶层默认为 candidate，子任务默认为 inherit，execution 为 idle/attempt 0；省略 acceptance 时规范化为稳定空数组。
