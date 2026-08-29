### Case DECISION-DISCARD-ONLY-ARCHIVED-ESTABLISHED-001: Discard 删除唯一 archived 已建立决策
Entry:
- `tools/decision-records/tests/candidate-lifecycle.test.ts > discarding the only archived established decision removes its archive path and index`
- `bun test --test-name-pattern="^discarding the only archived established decision removes its archive path and index$" ./tools/decision-records/tests/run.ts`
Contract:
- `discard` 同样可删除无引用的 archived 已建立决策。
Proves:
- 删除 archive 下的 Markdown；集合不再有已建立成员时同时移除派生索引。
