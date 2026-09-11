### Case TEST-EVIDENCE-CASE-FIRST-LINE-001: Case 标题必须位于首行

Tests:
- `test:79b5e9f8287834b2dd16b4f90d58ca6e911c2ec60b7422ea49c9be509f253c62`

Tags:
- `test-evidence`

Contract:
- 每个 Case 源的第一行必须是合法 `### Case <CASE-ID>: <title>` 标题。

Proves:
- 标题前的空行在完整 Case 校验中得到 case.heading-invalid 诊断。
