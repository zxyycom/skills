### Case INVESTIGATION-CLI-PREVIEW-RECOVERY-001: 调查全量预演损坏索引重建不持久写入

Tests:
- `test:fed4491bac9a037ab05fa2c031fc29254b6127153d2342da02331fa7a2e69203`

Tags:
- `investigation-report`

Contract:
- Investigation 全量 sync 可对合法来源预演损坏索引的重建，预演不持久写入；实际执行才发布。

Proves:
- IR full sync 服务对合法来源与损坏索引返回 previewed，索引字节保持；正式事务随后成功发布索引。本节点未执行 CLI，亦不证明缺失/旧 schema、selected 与 check 的各自边界。
