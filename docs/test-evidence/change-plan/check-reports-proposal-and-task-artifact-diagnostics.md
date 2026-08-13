### Case CHANGE-PLAN-CHECK-ARTIFACTS-001: 检查报告 proposal 与 tasks 问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports proposal and task artifact diagnostics`
- `bun test --test-name-pattern="^check reports proposal and task artifact diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Proposal 章节顺序与内容、tasks 的任务语法、ID 唯一性、必需区段和任务所在区段都必须逐项检查。
Proves:
- 顺序错误且内容为空的 proposal 返回 `section-order` 与 `empty-section`。
- tasks 中的非法语法、重复 ID、空 Verification 区段和额外区段任务分别返回对应诊断。
