### Case TEST-EVIDENCE-STAGE-METADATA-001: 选择性暂存拒绝跨定义索引迁移

Tests:
- `test:02d322638a68d66fff65adb3f49893357585288b20a207540510bf7098fb473a`

Tags:
- `test-evidence`

Contract:
- 索引 definitionVersion 改变时不能按单个 Case 选择性暂存。

Proves:
- 与基线不兼容的 definitionVersion 使选择性暂存返回 error。
