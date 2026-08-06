### Case TASK-GRAPH-ID-001: 扩展 ID 保持规范，失败批次不改变原索引或消耗编号

Entry:
- `tools/task-graph/tests/schema-index.test.ts > nextIds stay monotonic, extend beyond six digits, and failed apply consumes nothing`
- `bun test --test-name-pattern="^nextIds stay monotonic, extend beyond six digits, and failed apply consumes nothing$" ./tools/task-graph/tests/run.ts`

Contract:
- scope/task ID 单调分配、可扩展到六位以上，nextIds 必须严格大于已分配 ID。

Proves:
- 扩展 ID 保持规范，失败批次不改变原索引或消耗编号。
