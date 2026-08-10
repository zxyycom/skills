### Case TEST-EVIDENCE-LEDGER-API-TEST-QUERY-001: Test 查询 API 从权威实体派生反向 Case
Entry:
- `tools/test-evidence/tests/ledger-api.test.ts > ledger Test query API derives reverse Case memberships and searches entity authority`
- `bun test --test-name-pattern="^ledger Test query API derives reverse Case memberships and searches entity authority$" ./tools/test-evidence/tests/run.ts`
Contract:
- Test 查询必须搜索当前实体权威数据，并从 Case 索引键即时派生 Test→Cases。
Proves:
- Test ID、名称与 locator 都能定位 Gamma，结果带两个有序 Case ID，默认与最大 limit 生效且分页稳定。
