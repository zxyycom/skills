### Case TEST-EVIDENCE-LEDGER-INDEX-PROJECTION-001: Case 索引投影支持查询与 Tag

Tests:
- `test:9f785c8b981a3e5eee8157a374166e6ffd1ec598e63bb0df28464827512ec9b8`

Tags:
- `test-evidence`

Contract:
- Case 索引投影必须保留完成 Case-only 查询和 tags 所需的 Test 与 Tag 信息，不要求实体快照。

Proves:
- 同步后，按 tag 查询和 tags 列表都产生公开 schema 有效且内容正确的结果。
