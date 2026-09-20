### Case CHANGE-PLAN-CHECK-VALID-001: 有效 Plan 通过检查

Tests:
- `test:706c6be9e9fad74e52e2fb5b6c356789f8c53d41027bb00c55a04f1e5a7b7a58`

Tags:
- `change-plan`

Contract:
- 制品与 Plan metadata 完整且 Git 基线可用的 Change 应通过目录检查，并返回阶段、距离证据和任务进度。

Proves:
- 检查结果有效且无诊断，读取到的 metadata 与结果一致，并报告 Plan 的零距离证据和三个任务区段的准确计数。
