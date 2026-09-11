### Case TEST-EVIDENCE-LEDGER-API-VALIDATE-001: Case-only API 结果不依赖实体快照

Tests:
- `test:9f785c8b981a3e5eee8157a374166e6ffd1ec598e63bb0df28464827512ec9b8`

Tags:
- `test-evidence`

Contract:
- Case-only 的查询、tags、校验、show 与 search API 只依赖 Case 索引和来源，不要求实体快照。

Proves:
- 同步 Case 索引后，tag 查询、tags、validate、show 与 search 都返回各自公开 schema 有效的结果。
