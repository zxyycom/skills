### Case TASK-GRAPH-ATOMIC-DIFFERENT-001: 任意 atomic reject 都保守报告结果未知

Entry:
- `tools/task-graph/tests/store.test.ts > every rejected atomic write has one conservative outcome-unknown result`
- `bun test --test-name-pattern="^every rejected atomic write has one conservative outcome-unknown result$" ./tools/task-graph/tests/run.ts`

Contract:
- Atomic writer 每个候选只调用一次；调用 reject 后不读回、不猜测是否已经替换，也不自动重试。

Proves:
- writer 在替换前抛错、写入完整候选后抛错或留下不同文本后抛错，都只调用一次并返回带 possible revision 的 `WRITE_OUTCOME_UNKNOWN`。
