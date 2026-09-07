### Case TEST-EVIDENCE-LEDGER-INDEX-PROJECTION-001: Case 索引投影支持查询与 Tag

Tests:
- `test:f7c4dce8bcbf191958a208314365a709c8b4d8c23c72b05267da499522b01572`

Tags:
- `test-evidence`

Contract:
- Case 索引投影必须保留完成 Case-only 查询和 tags 所需的 Test 与 Tag 信息，不要求实体快照。

Proves:
- 同步后，按 tag 查询和 tags 列表都产生公开 schema 有效且内容正确的结果。
