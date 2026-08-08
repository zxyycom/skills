### Case CHANGE-PLAN-ASSESS-BASE-001: 计划基线不可用时要求复核
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment requires review when the plan base is unavailable`
- `bun test --test-name-pattern="^assessment requires review when the plan base is unavailable$" ./tools/change-plan/tests/run.ts`
Contract:
- 活动 plan 没有已确认基线或基线对象无法解析时，评估必须要求复核。
Proves:
- 空基线和不存在的提交均返回 `plan-review-required` 与 `base-unavailable` 原因，并报告当前 HEAD。
