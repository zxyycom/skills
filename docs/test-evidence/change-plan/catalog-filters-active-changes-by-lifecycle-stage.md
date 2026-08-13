### Case CHANGE-PLAN-CATALOG-STAGE-001: Catalog 按活动生命周期阶段筛选 Change
Entry:
- `tools/change-plan/tests/catalog.test.ts > catalog filters active changes by lifecycle stage`
- `bun test --test-name-pattern="^catalog filters active changes by lifecycle stage$" ./tools/change-plan/tests/run.ts`
Contract:
- 阶段筛选只适用于活动 Change，并只返回匹配该阶段的条目。
Proves:
- Draft 筛选只返回 draft Change；与 `status: all` 组合时返回空条目及明确错误。
- Plan 筛选把历史 `implementation` 与 `shelved` metadata 的兼容投影都作为 Plan 条目返回。
