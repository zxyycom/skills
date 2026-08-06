### Case TASK-GRAPH-CONCURRENCY-001: 排斥任务并发领取只有一个成功，同 revision 并发写入只有一个提交

Entry:
- `tools/task-graph/tests/store.test.ts > store serializes concurrent claims and global revision compare-and-swap`
- `bun test --test-name-pattern="^store serializes concurrent claims and global revision compare-and-swap$" ./tools/task-graph/tests/run.ts`

Contract:
- 共享索引的短锁串行化并发 claim，所有 revision 写入使用全局 compare-and-swap。

Proves:
- 排斥任务并发领取只有一个成功，同 revision 并发写入只有一个提交。
