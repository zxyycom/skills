### Case TASK-GRAPH-ID-001: 扩展 task ID 保持规范，失败批次不消耗编号

Entry:
- `tools/task-graph/tests/schema-index.test.ts > nextTaskId stays monotonic beyond six digits and failed apply consumes nothing`
- `bun test --test-name-pattern="^nextTaskId stays monotonic beyond six digits and failed apply consumes nothing$" ./tools/task-graph/tests/run.ts`

Contract:
- Task ID 单调分配并可扩展到六位以上，`nextTaskId` 必须严格大于全部已分配 task ID。

Proves:
- 七位 task ID 保持规范；失败 apply 不改变原索引或消耗编号，回退计数器的索引被拒绝。
