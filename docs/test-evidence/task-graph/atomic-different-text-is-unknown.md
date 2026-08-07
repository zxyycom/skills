### Case TASK-GRAPH-ATOMIC-DIFFERENT-001: 单次 atomic 留下不同原文时结果未知

Entry:
- `tools/task-graph/tests/store.test.ts > single atomic write leaving different text returns WRITE_OUTCOME_UNKNOWN`
- `bun test --test-name-pattern="^single atomic write leaving different text returns WRITE_OUTCOME_UNKNOWN$" ./tools/task-graph/tests/run.ts`

Contract:
- atomic 抛错后既非完整旧原文也非完整候选的状态不得猜测或自动重试。

Proves:
- writer 一次写入损坏文本后返回 `WRITE_OUTCOME_UNKNOWN`，observedRevision 为 unreadable。
