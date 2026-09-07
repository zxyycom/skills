### Case TEST-EVIDENCE-LEDGER-SCHEMA-STRICT-001: Reference snapshot 失败状态严格分离

Tests:
- `test:2c9508d7c7b9648420d4c003b17d58af34d1a9c4de5d265708488b384839c326`

Tags:
- `test-evidence`

Contract:
- Reference snapshot 校验必须严格分离结构无效、来源不匹配和未知 Case 选择，不能将它们合并为成功或同一状态。

Proves:
- 旧 schema、错误 revision 和未知 Case 分别得到 `snapshot-invalid`、`source-mismatch` 与 `case-invalid`。
