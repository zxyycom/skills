### Case TEST-EVIDENCE-LEDGER-API-CASE-QUERY-001: Case 查询按 tag/test 精确筛选并稳定分页

Tests:
- `test:3d37b638f25c203355812e9f90f34789cfaeaa0d85deb0a4e912ed396ef5ec11`

Tags:
- `test-evidence`

Contract:
- 持久索引上的 Case 查询必须以 tag 的 AND、精确 Test ID、Case ID 词典序和 offset/limit 分页组合筛选。

Proves:
- 13 个 Case 中，双 tag 与精确 Test 只返回匹配 Case；按一个 tag 查询时 offset 10、limit 3 返回连续的词典序页。
