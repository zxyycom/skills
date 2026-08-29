### Case DECISION-DISCARD-ONLY-ACTIVE-ESTABLISHED-001: Discard 删除唯一 active 已建立决策并移除派生索引
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discarding the only active established decision removes the derived index`
- `bun test --test-name-pattern="^discarding the only active established decision removes the derived index$" ./tools/decision-records/tests/run.ts`
Contract:
- `discard` 可删除无引用的 active 已建立决策；删除后没有任何已建立决策时，不保留空派生索引。
Proves:
- 唯一 active 决策的 Markdown 与 `decision-index.json` 都被移除。
