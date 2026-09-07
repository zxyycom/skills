### Case DECISION-CANDIDATE-INDEX-CONTEXT-001: 已建立记录要求当前有效索引

Tests:
- `test:950dd348ae627ba301089353b068cd2e626eed15fb022bdd961ff0e82ae38062`

Tags:
- `decision-records`

Contract:
- 已存在 established records 时，candidates collection 必须拒绝缺失、无效或来源漂移的 index。

Proves:
- 三种 index 状态均失败且不输出候选结果。
