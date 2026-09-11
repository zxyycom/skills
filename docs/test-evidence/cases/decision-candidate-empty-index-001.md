### Case DECISION-CANDIDATE-EMPTY-INDEX-001: 空索引阻断唯一候选的查询

Tests:
- `test:ce133d48c9b588030f0cae6943404613dcbab55f9a5fc65ac65c289cf655cf51`

Tags:
- `decision-records`

Contract:
- 仅 candidate 但存在结构有效的空 decision-index 时，collection 不是首次发现；`candidates` 和 `show-candidate` 都必须在 collection 层失败。只有 index 缺失时才允许首次候选发现。

Proves:
- 删除全部 established 后写入空 entries/sourceRevision index，两个查询均非零、无 stdout 并报告 index 问题。
