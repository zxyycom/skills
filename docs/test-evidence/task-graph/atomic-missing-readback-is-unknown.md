### Case TASK-GRAPH-ATOMIC-READBACK-001: atomic 成功但回读缺失时结果未知

Entry:
- `tools/task-graph/tests/store.test.ts > successful atomic call with missing readback returns WRITE_OUTCOME_UNKNOWN`
- `bun test --test-name-pattern="^successful atomic call with missing readback returns WRITE_OUTCOME_UNKNOWN$" ./tools/task-graph/tests/run.ts`

Contract:
- atomic 调用成功后仍必须逐字回读完整候选，缺失或不等都按未知结果处理。

Proves:
- writer 一次删除目标并返回后得到 `WRITE_OUTCOME_UNKNOWN`，observedRevision 为 null。
