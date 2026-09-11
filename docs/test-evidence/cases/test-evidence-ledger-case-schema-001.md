### Case TEST-EVIDENCE-LEDGER-CASE-SCHEMA-001: Case 语法要求首行固定 ID 与唯一完整 Case

Tests:
- `test:79b5e9f8287834b2dd16b4f90d58ca6e911c2ec60b7422ea49c9be509f253c62`

Tags:
- `test-evidence`

Contract:
- 每个 Case 文件必须以合法固定 Case ID 标题开头，使用固定字段顺序，且只包含一个完整 Case。

Proves:
- 前置空行和非法 ID 产生 `case.heading-invalid`；旧 `Entry:`、缺少 Proves 与乱序字段在各自路径产生 `case.section-invalid`；同一文件中第二个 Case 标题产生 `case.content-unsupported`。
