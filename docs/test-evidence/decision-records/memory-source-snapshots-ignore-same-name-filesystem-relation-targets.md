### Case DECISION-STATE-MEMORY-RELATION-SOURCE-001: 内存快照关系只解析同一来源集合

Entry:
- `tools/decision-records/tests/state-snapshot.test.ts > memory source snapshots ignore same-name filesystem relation targets`
- `bun test --test-name-pattern="^memory source snapshots ignore same-name filesystem relation targets$" ./tools/decision-records/tests/state-snapshot.test.ts`

Contract:
- 内存决策快照的关系目标只能由同一内存来源集合提供，磁盘上的同名决策不得补足目标集合。

Proves:
- 从内存来源移除关系目标后，即使文件系统仍有同名决策，快照仍以目标不存在拒绝构造。
