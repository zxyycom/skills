### Case DECISION-CANDIDATE-EMPTY-INDEX-001: 候选收集不依赖空已发布索引

Tests:
- `test:b9180a5d6b2bad54e060b9cc2fda7e515597c5bf826eb50341281e394ffd5869`

Tags:
- `decision-records`

Contract:
- 仅剩 candidate 且已发布 decision-index 为结构有效的空 entries 时，collection 不得依赖该空索引；`candidates` 和 `show-candidate` 都必须从来源继续返回候选并成功。

Proves:
- 删除全部 established 并写入空 entries/sourceRevision index 后，两个查询均零退出并在 stdout 返回该候选。
