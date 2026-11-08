### Case DECISION-INDEX-ALIGNMENT-WRITE-GUARD-001: 非法对齐值不能进入索引

Tests:
- `test:398e9d0f7d82933d4600f613a50fa29cf9016eccf39ca0dc81e15d0e6d53b0be`

Tags:
- `decision-records`

Contract:
- 非法对齐值不能进入索引。

Proves:
- 已建立来源的 alignment 改为 null 后，真实 CLI `check` 与 `sync-index` 均失败、JSON `ok:false`，来源和既有索引字节保持；节点不单独断言字段定位。
