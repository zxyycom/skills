### Case DECISION-STATE-MEMORY-CYCLE-001: 内存快照拒绝决策关系环

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots reject relationship cycles`
- `bun test --test-name-pattern="^memory source snapshots reject relationship cycles$" ./tools/decision-records/tests/state-snapshot.test.ts`

Contract:
- 从内存来源构造的完整决策关系图必须保持无环，与文件系统索引构造使用相同关系不变量。

Proves:
- 两条内存决策来源形成闭环时，快照以关系不得成环的诊断拒绝构造。
