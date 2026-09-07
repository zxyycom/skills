### Case TEST-EVIDENCE-LEDGER-API-OPTIONS-001: 公共 API 对无效 options 返回结构化领域失败

Tests:
- `test:e9a1ab88fdf23ef343e1b640ea22d320690ea69e6256035033dc358ac865aaef`

Tags:
- `test-evidence`

Contract:
- 公共 API 的无效 options 与 CLI usage 错误分离，必须返回公开 schema 有效的结构化领域结果。

Proves:
- `queryTestEvidence` 的 `limit: 0` 返回有效 query 结果，并含 `query.options-invalid` 诊断。
