### Case TEST-EVIDENCE-QUERY-KEYED-ID-001: 查询结果以 Record Key 作为权威 Case 身份

Entry:
- `tools/test-evidence/tests/run.ts > query results use record keys as authoritative case identities`
- `bun test --test-name-pattern="^query results use record keys as authoritative case identities$" ./tools/test-evidence/tests/run.ts`

Contract:
- 普通查询必须从 persisted `entries` 的 record key 附加 Case ID，不得以 stored state 内重复保存的 ID 恢复查询身份。

Proves:
- 将 access entry 的 stored state ID 改成另一个合法 Case ID 后，查询不产生诊断，并仍为该源路径返回 record key `AUTH-ROLE-ACCESS-001`。
