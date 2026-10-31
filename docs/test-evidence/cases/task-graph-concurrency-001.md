### Case TASK-GRAPH-CONCURRENCY-001: 原生短锁串行化同 revision 并发 mutation

Tests:
- `test:671af89c481c4cdc499df9b2538f4c1530e1b3b418f9b084eedfe8ca36338193`

Tags:
- `task-graph`

Contract:
- 共享索引的原生短锁必须串行化并发 mutation，revision 继续使用全局 compare-and-swap。

Proves:
- 两个独立 service 同时以 revision 0 创建 task 时只有一个提交，另一个得到 `REVISION_CONFLICT`，最终 revision 为 1。
