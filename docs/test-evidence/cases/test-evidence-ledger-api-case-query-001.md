### Case TEST-EVIDENCE-LEDGER-API-CASE-QUERY-001: Case 查询按 tag/test 精确筛选并稳定分页

Tests:
- `test:a4b4b770f1089627bdc39037d8c83fa331cc258b318e74639811a4f157e17d47`

Tags:
- `test-evidence`

Contract:
- 持久索引上的 Case 查询必须以 tag 的 AND、精确 Test ID、Case ID 词典序和 offset/limit 分页组合筛选。

Proves:
- 13 个 Case 中，双 tag 与精确 Test 只返回匹配 Case；按一个 tag 查询时 offset 10、limit 3 返回连续的词典序页。
