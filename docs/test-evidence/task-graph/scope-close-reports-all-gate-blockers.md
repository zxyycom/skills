### Case TASK-GRAPH-SCOPE-CLOSE-001: GC 查询区分全部 blocker

Entry:
- `tools/task-graph/tests/scope-repository.test.ts > scope close projection reports terminal, failed, active, and recovery blockers`
- `bun test --test-name-pattern="^scope close projection reports terminal, failed, active, and recovery blockers$" ./tools/task-graph/tests/run.ts`

Contract:
- scope close 要求顶层终态、无 failed、active 或 recovery-needed task，并显式确认结果交付。

Proves:
- GC 查询区分全部 blocker；service 对缺失或 false 的 `resultsDelivered` 都拒绝，并要求 binding filter kind/value 成对出现；满足门禁的单 scope 才原子删除。
