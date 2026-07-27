### Case CHANGE-PLAN-CHECK-ARTIFACTS-001: 检查报告 proposal 与 tasks 问题
Entry:
- `tools/change-plan/tests/check.test.ts > check reports proposal and task artifact diagnostics`
- `bun test --test-name-pattern="^check reports proposal and task artifact diagnostics$" ./tools/change-plan/tests/run.ts`
Contract:
- Proposal 和 tasks 的必需结构与完成状态必须被逐项检查。
Proves:
- 缺失或无效制品产生对应文件和规则诊断。
