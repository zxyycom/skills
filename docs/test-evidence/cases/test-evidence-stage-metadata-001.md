### Case TEST-EVIDENCE-STAGE-METADATA-001: 选择性暂存拒绝跨定义索引迁移

Tests:
- `test:0ed768891742e00d3fbb746e3123b7555586be5ff1d184e925938f1de9eb1956`

Tags:
- `test-evidence`

Contract:
- 索引 definitionVersion 改变时不能按单个 Case 选择性暂存。

Proves:
- 与基线不兼容的 definitionVersion 使选择性暂存返回 error。
