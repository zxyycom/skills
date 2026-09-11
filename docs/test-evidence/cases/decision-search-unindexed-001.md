### Case DECISION-SEARCH-UNINDEXED-001: Decision search 不信任漏掉正式来源的索引

Tests:
- `test:eda7e0d36af908a0ed1ae58b8c51eba83220c1e07519285ffe7960f76690468c`

Tags:
- `decision-records`

Contract:
- 发现新的已建立 Decision 来源但持久索引未收录时，搜索必须回退到已验证只读来源投影，而非把遗漏来源视为没有结果。

Proves:
- 新正式 Markdown 中的稀有正文词返回其语义 Decision ID。
- stderr 说明使用只读验证来源投影。
