### Case TASK-GRAPH-CONCURRENCY-001: 原生短锁串行化同 revision 并发 mutation

Tests:
- `test:5ed2a2a6a71cf8fccc57a89422c8d360a186f871e6d547db9cedf284bf79e99a`

Tags:
- `task-graph`

Contract:
- 共享索引的原生短锁必须串行化并发 mutation，revision 继续使用全局 compare-and-swap。

Proves:
- 两个独立 service 同时以 revision 0 创建 task 时只有一个提交，另一个得到 `REVISION_CONFLICT`，最终 revision 为 1。
