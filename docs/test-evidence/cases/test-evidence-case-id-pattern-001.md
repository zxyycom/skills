### Case TEST-EVIDENCE-CASE-ID-PATTERN-001: Case ID 使用固定协议

Tests:
- `test:e111094bc27bf65ea450edddb7a89e28075fff24d63dda5fd52b0a9e7a23e806`

Tags:
- `test-evidence`

Contract:
- 每个 Case 标题的 ID 必须符合工具内置且不可配置的固定格式。

Proves:
- 不符合固定格式的标题在完整 Case 校验中得到 case.heading-invalid 诊断。
