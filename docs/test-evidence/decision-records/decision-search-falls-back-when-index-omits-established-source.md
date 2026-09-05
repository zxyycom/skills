### Case DECISION-SEARCH-UNINDEXED-001: Decision search 不信任漏掉正式来源的索引

Entry:
- `tools/decision-records/tests/queries.test.ts > decision search does not trust an index that omits a new established source`
- `bun test --test-name-pattern="^decision search does not trust an index that omits a new established source$" ./tools/decision-records/tests/run.ts`

Contract:
- 发现新的已建立 Decision 来源但持久索引未收录时，搜索必须回退到已验证只读来源投影，而非把遗漏来源视为没有结果。

Proves:
- 新正式 Markdown 中的稀有正文词返回其语义 Decision ID。
- stderr 说明使用只读验证来源投影。
