### Case TEST-EVIDENCE-LEDGER-CLI-LIST-001: Node CLI list 组合筛选并返回有效 JSON

Tests:
- `test:cc32f7acee11c637e394edf39ba0a40f79f26130c2930009e7d64cd1f60cd2ac`

Tags:
- `test-evidence`

Contract:
- 分发 Node CLI 的 list 必须按 tag 与精确 Test 组合筛选，并返回公开 schema 有效的查询 JSON。

Proves:
- `alpha` tag 与 `test:shared` 组合且 limit 1、offset 0 时只返回 alpha Case。
