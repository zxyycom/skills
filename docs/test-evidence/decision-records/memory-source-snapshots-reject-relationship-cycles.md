### Case DECISION-STATE-MEMORY-CYCLE-001: 内存来源拒绝关系环

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots reject relationship cycles`
- `bun test --test-name-pattern="^memory source snapshots reject relationship cycles$" ./tools/decision-records/tests/run.ts`

Contract:
- 快照构造必须拒绝闭环关系图。

Proves:
- 构造两记录的互相修订，断言 cycle 错误。
