### Case TEST-EVIDENCE-LEDGER-ENTITY-SCHEMA-001: Reference snapshot 明确拒绝无效来源与未知 Case

Tests:
- `test:44e497b1c1b311e49165d61a7bfe5126dc8b881867f5d4ab6b0837eed3b78968`

Tags:
- `test-evidence`

Contract:
- 引用校验必须区分无效 snapshot、预期来源不匹配与未知所选 Case 的失败状态。

Proves:
- 旧 snapshot schemaVersion 返回 `snapshot-invalid`；revision 不同返回 `source-mismatch`；未知 selected Case 返回 `case-invalid`。
