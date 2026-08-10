### Case TEST-EVIDENCE-LEDGER-API-OPTIONS-001: Ledger 内部 API 对无效 options 返回结构化机器失败
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger APIs return schema-valid machine failures for invalid options`
- `bun test --test-name-pattern="^ledger APIs return schema-valid machine failures for invalid options$" ./tools/test-evidence/tests/run.ts`
Contract:
- 五个仓库内部 API 不得因 options 无效而泄漏非结构化异常，必须返回各自的领域 `schemaVersion: 5` 机器结果。
Proves:
- 空 root、非法 mode/limit/Case ID 与空白 query 都返回 blocking `query.options-invalid` 诊断，且 message 标出无效字段。
