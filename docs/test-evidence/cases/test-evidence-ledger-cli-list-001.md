### Case TEST-EVIDENCE-LEDGER-CLI-LIST-001: Node CLI list 组合筛选并返回有效 JSON

Tests:
- `test:c903506fc68935cecd1eb13f216a5583b328ff46c3d48757d0e5541ccb13fb4e`

Tags:
- `test-evidence`

Contract:
- 分发 Node CLI 的 list 必须按 tag 与精确 Test 组合筛选，并返回公开 schema 有效的查询 JSON。

Proves:
- `alpha` tag 与 `test:shared` 组合且 limit 1、offset 0 时只返回 alpha Case。
