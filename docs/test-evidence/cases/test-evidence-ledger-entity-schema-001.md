### Case TEST-EVIDENCE-LEDGER-ENTITY-SCHEMA-001: Reference snapshot 明确拒绝无效来源与未知 Case

Tests:
- `test:2c9508d7c7b9648420d4c003b17d58af34d1a9c4de5d265708488b384839c326`

Tags:
- `test-evidence`

Contract:
- 引用校验必须区分无效 snapshot、预期来源不匹配与未知所选 Case 的失败状态。

Proves:
- 旧 snapshot schemaVersion 返回 `snapshot-invalid`；revision 不同返回 `source-mismatch`；未知 selected Case 返回 `case-invalid`。
