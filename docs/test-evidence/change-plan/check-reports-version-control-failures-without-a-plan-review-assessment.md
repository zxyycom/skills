### Case CHANGE-PLAN-CHECK-VC-001: 检查区分版本控制故障与计划复核
Entry:
- `tools/change-plan/tests/check.test.ts > check reports version-control failures without a plan-review assessment`
- `bun test --test-name-pattern="^check reports version-control failures without a plan-review assessment$" ./tools/change-plan/tests/run.ts`
Contract:
- Plan assessment 只有在版本控制查询成功后才能形成；版本控制操作失败不能伪装成 `plan-review-required` 领域结果。
Proves:
- 非仓库中的合法 plan 返回空 assessment、`version-control-failed` 诊断和失败 check，且不产生 `plan-review-required` 诊断。
