### Case DECISION-SEARCH-UNINDEXED-001: Decision search 不信任漏掉正式来源的索引

Tests:
- `test:8c96fb4dffb9c8e69d190cbf0a6a36991fbae37dbd73620372d53ded18851eb1`

Tags:
- `decision-records`

Contract:
- 发现新的已建立 Decision 来源但持久索引未收录时，搜索必须回退到已验证只读来源投影，而非把遗漏来源视为没有结果。

Proves:
- 新正式 Markdown 中的稀有正文词返回其语义 Decision ID。
- stderr 说明使用只读验证来源投影。
