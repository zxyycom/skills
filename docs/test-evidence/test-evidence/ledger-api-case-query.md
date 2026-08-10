### Case TEST-EVIDENCE-LEDGER-API-CASE-QUERY-001: Case 查询 API 组合筛选并稳定分页
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger Case query API intersects filters and applies stable pagination`
- `bun test --test-name-pattern="^ledger Case query API intersects filters and applies stable pagination$" ./tools/test-evidence/tests/run.ts`
Contract:
- Case 查询必须对 Test、Tag 与全文条件取交集，并按 Case ID 稳定分页。
Proves:
- 组合条件只返回共同匹配 Case，默认与最大 limit 生效，未使用 Tag 返回空集，未知 Test 返回领域诊断。
