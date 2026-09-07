### Case CHANGE-PLAN-CHECK-COMPLETE-001: 完整计划通过检查

Tests:
- `test:3527cf14fb7d9541f7fe01c114865e4e5be1d702cced039dc16a9b54f36af246`

Tags:
- `change-plan`

Contract:
- 制品与 Plan metadata 完整且 Git 基线可用的 Change 应通过目录检查，并返回阶段、距离证据和任务进度。

Proves:
- 检查结果有效且无诊断，读取到的 metadata 与结果一致，并报告 Plan 的零距离证据和三个任务区段的准确计数。
