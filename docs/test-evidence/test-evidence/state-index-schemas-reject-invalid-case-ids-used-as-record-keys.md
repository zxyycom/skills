### Case TEST-EVIDENCE-RECORD-KEY-SCHEMA-001: State Index Schema 拒绝非法 Case ID Record Key

Entry:
- `tools/test-evidence/tests/run.ts > state index schemas reject invalid case IDs used as record keys`
- `bun test --test-name-pattern="^state index schemas reject invalid case IDs used as record keys$" ./tools/test-evidence/tests/run.ts`

Contract:
- Test-evidence 的 Valibot schema 与生成 JSON Schema 必须在 `entries` 和 `sourceRevision.entries` 的对象键上共同执行 Case ID 格式约束。

Proves:
- 生成 JSON Schema 接受当前合法索引。
- 将 `entries` 或 `sourceRevision.entries` 中一个合法 key 替换为 `not-a-case-id` 后，Valibot 与生成 JSON Schema 都拒绝该索引。
