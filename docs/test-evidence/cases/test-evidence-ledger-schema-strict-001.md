### Case TEST-EVIDENCE-LEDGER-SCHEMA-STRICT-001: Reference snapshot 失败状态严格分离

Tests:
- `test:44e497b1c1b311e49165d61a7bfe5126dc8b881867f5d4ab6b0837eed3b78968`

Tags:
- `test-evidence`

Contract:
- Reference snapshot 校验必须严格分离结构无效、来源不匹配和未知 Case 选择，不能将它们合并为成功或同一状态。

Proves:
- 旧 schema、错误 revision 和未知 Case 分别得到 `snapshot-invalid`、`source-mismatch` 与 `case-invalid`。
