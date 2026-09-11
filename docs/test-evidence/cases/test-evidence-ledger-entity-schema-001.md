### Case TEST-EVIDENCE-LEDGER-ENTITY-SCHEMA-001: Reference snapshot 明确拒绝无效来源与未知 Case

Tests:
- `test:66d35d8fc37a3b36db5726792d11eda84023c2c0da21adcdc51adc8e28bfb186`

Tags:
- `test-evidence`

Contract:
- 引用校验必须区分无效 snapshot、预期来源不匹配与未知所选 Case 的失败状态。

Proves:
- 旧 snapshot schemaVersion 返回 `snapshot-invalid`；revision 不同返回 `source-mismatch`；未知 selected Case 返回 `case-invalid`。
