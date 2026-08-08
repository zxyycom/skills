### Case CHANGE-PLAN-CHECK-COMPLETE-001: 完整计划通过检查且 API 一致
Entry:
- `tools/change-plan/tests/check.test.ts > check accepts a complete plan with bundled API parity`
- `bun test --test-name-pattern="^check accepts a complete plan with bundled API parity$" ./tools/change-plan/tests/run.ts`
Contract:
- 制品和 implementation 阶段元数据完整的计划应通过源 API 与 bundled API 检查，并返回一致的阶段、评估和任务进度。
Proves:
- 两种入口都返回成功且无诊断，并给出相同的元数据、阶段、评估和分阶段任务计数。
