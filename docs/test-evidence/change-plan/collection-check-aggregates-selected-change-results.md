### Case CHANGE-PLAN-COLLECTION-CHECK-001: 集合检查聚合所选 Change 结果
Entry:
- `tools/change-plan/tests/catalog.test.ts > collection check aggregates selected change results`
- `bun test --test-name-pattern="^collection check aggregates selected change results$" ./tools/change-plan/tests/run.ts`
Contract:
- 集合检查必须复用 catalog 的 active、archived 与 all 成员选择，并从完整逐项检查结果派生稳定计数和整体有效性。
Proves:
- 无效成员会保留诊断并使集合失败，显式 archived 选择可以独立通过，all 会包含两类成员。
