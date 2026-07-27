### Case CHANGE-PLAN-CATALOG-SHOW-001: Show 保留生命周期与分发 API 一致性
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog shows lifecycle status with bundled API parity`
- `bun test --test-name-pattern="^catalog shows lifecycle status with bundled API parity$" ./tools/change-plan/tests/run.ts`
Contract:
- Show 结果必须包含计划生命周期，并与 bundled API 输出一致。
Proves:
- 源实现和分发实现对同一 change 返回相同状态与制品。
