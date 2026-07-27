### Case CHANGE-PLAN-CHECK-COMPLETE-001: 完整计划通过检查且 API 一致
Entry:
- `tools/change-plan/tests/check.test.ts > check accepts a complete plan with bundled API parity`
- `bun test --test-name-pattern="^check accepts a complete plan with bundled API parity$" ./tools/change-plan/tests/run.ts`
Contract:
- 制品完整且内容有效的计划应通过源 API 与 bundled API 检查。
Proves:
- 两种入口都返回成功且无诊断。
