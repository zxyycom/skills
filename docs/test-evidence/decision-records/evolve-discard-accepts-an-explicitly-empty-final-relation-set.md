### Case DECISION-EVOLVE-DISCARD-EMPTY-001: Evolve discard 接受显式空的最终关系集合
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard accepts an explicitly empty final relation set`
- `bun test --test-name-pattern="^evolve discard accepts an explicitly empty final relation set$" ./tools/decision-records/tests/run.ts`
Contract:
- `--clear-relations` 将所选后继的完整最终关系替换为空，并可与 `--discard` 同一事务使用。
Proves:
- 事务删除目标并建立关系为空的后继。
