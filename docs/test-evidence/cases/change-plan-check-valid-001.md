### Case CHANGE-PLAN-CHECK-VALID-001: 有效 Plan 通过检查

Tests:
- `test:90c0f805bdf8f5ed9020dd0dbca544f4168b7fe65311c63a3da0dc5f2eaaaefd`

Tags:
- `change-plan`

Contract:
- 制品与 Plan metadata 完整且 Git 基线可用的 Change 应通过目录检查，并返回阶段、距离证据和任务进度。

Proves:
- 检查结果有效且无诊断，读取到的 metadata 与结果一致，并报告 Plan 的零距离证据和三个任务区段的准确计数。
