### Case DECISION-CANDIDATE-EMPTY-INDEX-001: 候选收集不依赖空已发布索引

Tests:
- `test:e434ce572487d0f9a7daa1f48940d553b501f18014d72587a4d5d2084c49e2aa`

Tags:
- `decision-records`

Contract:
- 仅剩 candidate 且已发布 decision-index 为结构有效的空 entries 时，collection 不得依赖该空索引；`candidates` 和 `show-candidate` 都必须从来源继续返回候选并成功。

Proves:
- 删除全部 established 并写入空 entries/sourceRevision index 后，两个查询均零退出并在 stdout 返回该候选。
