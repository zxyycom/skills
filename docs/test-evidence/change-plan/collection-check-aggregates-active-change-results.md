### Case CHANGE-PLAN-COLLECTION-CHECK-001: 集合检查只聚合 Active Change 结果
Entry:
- `tools/change-plan/tests/catalog.test.ts > collection check aggregates active change results`
- `bun test --test-name-pattern="^collection check aggregates active change results$" ./tools/change-plan/tests/run.ts`
Contract:
- 集合检查固定门禁 change root 的 active 直接成员，并从完整逐项检查结果派生稳定计数和整体有效性。
Proves:
- 无效 active 成员保留诊断并使集合失败，有效 active 成员进入对应计数。
- 即使 archive 中存在无效历史目录，聚合结果仍只包含 `status: active` 的两个直接成员。
