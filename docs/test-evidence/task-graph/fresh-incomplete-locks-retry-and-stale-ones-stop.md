### Case TASK-GRAPH-LOCK-FRESH-001: fresh lock 消失后写入继续，stale incomplete lock 返回 LOCK_RECOVERY_REQUIRED

Entry:
- `tools/task-graph/tests/store.test.ts > fresh incomplete locks retry while stale incomplete locks require recovery`
- `bun test --test-name-pattern="^fresh incomplete locks retry while stale incomplete locks require recovery$" ./tools/task-graph/tests/run.ts`

Contract:
- fresh incomplete lock 属于发布窗口并重试，超过陈旧阈值仍不被盲目回收。

Proves:
- fresh lock 消失后写入继续，stale incomplete lock 返回 LOCK_RECOVERY_REQUIRED。
