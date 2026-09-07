### Case TEST-EVIDENCE-LEDGER-API-VALIDATE-001: Case-only API 结果不依赖实体快照

Tests:
- `test:f7c4dce8bcbf191958a208314365a709c8b4d8c23c72b05267da499522b01572`

Tags:
- `test-evidence`

Contract:
- Case-only 的查询、tags、校验、show 与 search API 只依赖 Case 索引和来源，不要求实体快照。

Proves:
- 同步 Case 索引后，tag 查询、tags、validate、show 与 search 都返回各自公开 schema 有效的结果。
