### Case TEST-EVIDENCE-LEDGER-API-CASE-QUERY-001: Case 查询按 tag/test 精确筛选并稳定分页

Tests:
- `test:ab127d35d855861bdb20c52eb87be2a6aef104a45d94ac7ea3d4d27db1c74dec`

Tags:
- `test-evidence`

Contract:
- 持久索引上的 Case 查询必须以 tag 的 AND、精确 Test ID、Case ID 词典序和 offset/limit 分页组合筛选。

Proves:
- 1,000 个 Case 中，双 tag 与精确 Test 只返回匹配 Case；按一个 tag 查询时 offset 10、limit 3 返回连续的词典序页。
