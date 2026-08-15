### Case DECISION-STATE-MEMORY-RELATION-SOURCE-001: 内存来源拒绝缺失的关系目标

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots ignore same-name filesystem relation targets`
- `bun test --test-name-pattern="^memory source snapshots ignore same-name filesystem relation targets$" ./tools/decision-records/tests/run.ts`

Contract:
- 内存快照只能以传入 source 集合解析关系，缺失 ID 目标不得由磁盘文件补足。

Proves:
- 移除归档目标 source 后构造快照，断言关系目标不存在。
