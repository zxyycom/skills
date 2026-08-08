### Case CHANGE-PLAN-ASSESS-SCOPE-001: 评估只适用于活动 Plan 阶段
Entry:
- `tools/change-plan/tests/assessment.test.ts > assessment is not applicable outside active plan stage`
- `bun test --test-name-pattern="^assessment is not applicable outside active plan stage$" ./tools/change-plan/tests/run.ts`
Contract:
- 智能搁置评估只作用于活动生命周期中的 `plan` 阶段。
Proves:
- Draft 和归档 plan 均直接返回 `not-applicable`，且不要求所在路径是 Git 仓库。
