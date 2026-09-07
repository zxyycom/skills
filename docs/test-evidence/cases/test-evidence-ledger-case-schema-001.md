### Case TEST-EVIDENCE-LEDGER-CASE-SCHEMA-001: Case 语法要求首行固定 ID 与唯一完整 Case

Tests:
- `test:e111094bc27bf65ea450edddb7a89e28075fff24d63dda5fd52b0a9e7a23e806`

Tags:
- `test-evidence`

Contract:
- 每个 Case 文件必须以合法固定 Case ID 标题开头，使用固定字段顺序，且只包含一个完整 Case。

Proves:
- 前置空行和非法 ID 产生 `case.heading-invalid`；旧 `Entry:`、缺少 Proves 与乱序字段在各自路径产生 `case.section-invalid`；同一文件中第二个 Case 标题产生 `case.content-unsupported`。
