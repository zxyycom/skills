### Case DECISION-STATE-MEMORY-ACTIVE-TARGET-001: 内存快照拒绝活动关系目标

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots reject active relationship targets`
- `bun test --test-name-pattern="^memory source snapshots reject active relationship targets$" ./tools/decision-records/tests/state-snapshot.test.ts`

Contract:
- 决策演进关系的直接目标必须在同一目标快照中处于归档状态，内存来源不能绕过该生命周期约束。

Proves:
- 把关系目标改为活动且已对齐后，内存快照以目标必须归档的诊断拒绝构造。
