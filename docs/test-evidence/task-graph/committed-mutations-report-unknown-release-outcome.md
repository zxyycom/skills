### Case TASK-GRAPH-LOCK-RELEASE-002: unlock 与 close 都失败时已提交 mutation 返回未知结果

Entry:
- `tools/task-graph/tests/store.test.ts > failed unlock and close classify a committed mutation as outcome unknown`
- `bun test --test-name-pattern="^failed unlock and close classify a committed mutation as outcome unknown$" ./tools/task-graph/tests/run.ts`

Contract:
- mutation 已完成候选提交与读回后，原生 unlock 和句柄 close 都失败时不能把结果报告为未提交。

Proves:
- 返回带 `phase: lock-release` 和候选 revision 的 `WRITE_OUTCOME_UNKNOWN`，禁止调用方盲目重放。
