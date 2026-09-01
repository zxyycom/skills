### Case DECISION-EVOLVE-DISCARD-001: Evolve 以显式最终关系删除中间决策
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discards an intermediate with explicit final relations`
- `bun test --test-name-pattern="^evolve discards an intermediate with explicit final relations$" ./tools/decision-records/tests/run.ts`
Contract:
- `evolve --discard` 删除无引用决策，并把调用方提供的关系作为后继完整最终关系集合。
Proves:
- 删除目标从 Markdown 和派生索引移除；后继采用显式最终关系且严格检查通过。
