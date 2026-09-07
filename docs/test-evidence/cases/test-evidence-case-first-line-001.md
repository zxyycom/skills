### Case TEST-EVIDENCE-CASE-FIRST-LINE-001: Case 标题必须位于首行

Tests:
- `test:e111094bc27bf65ea450edddb7a89e28075fff24d63dda5fd52b0a9e7a23e806`

Tags:
- `test-evidence`

Contract:
- 每个 Case 源的第一行必须是合法 `### Case <CASE-ID>: <title>` 标题。

Proves:
- 标题前的空行在完整 Case 校验中得到 case.heading-invalid 诊断。
