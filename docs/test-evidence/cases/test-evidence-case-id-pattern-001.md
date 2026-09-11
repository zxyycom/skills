### Case TEST-EVIDENCE-CASE-ID-PATTERN-001: Case ID 使用固定协议

Tests:
- `test:79b5e9f8287834b2dd16b4f90d58ca6e911c2ec60b7422ea49c9be509f253c62`

Tags:
- `test-evidence`

Contract:
- 每个 Case 标题的 ID 必须符合工具内置且不可配置的固定格式。

Proves:
- 不符合固定格式的标题在完整 Case 校验中得到 case.heading-invalid 诊断。
