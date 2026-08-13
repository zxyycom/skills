### Case CHANGE-PLAN-CHECK-COMPLETE-001: 完整计划通过检查
Entry:
- `tools/change-plan/tests/check.test.ts > check accepts a complete plan`
- `bun test --test-name-pattern="^check accepts a complete plan$" ./tools/change-plan/tests/run.ts`
Contract:
- 制品与 Plan metadata 完整且 Git 基线可用的 Change 应通过目录检查，并返回阶段、距离证据和任务进度。
Proves:
- 检查结果有效且无诊断，读取到的 metadata 与结果一致，并报告 Plan 的零距离证据和三个任务区段的准确计数。
