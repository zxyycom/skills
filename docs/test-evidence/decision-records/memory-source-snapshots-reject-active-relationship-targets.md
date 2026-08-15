### Case DECISION-STATE-MEMORY-ACTIVE-TARGET-001: 内存来源拒绝活动关系目标

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots reject active relationship targets`
- `bun test --test-name-pattern="^memory source snapshots reject active relationship targets$" ./tools/decision-records/tests/run.ts`

Contract:
- 修订关系目标必须是归档记录，内存来源同样执行此图约束。

Proves:
- 把关系目标改为 active 后构造快照，断言拒绝。
