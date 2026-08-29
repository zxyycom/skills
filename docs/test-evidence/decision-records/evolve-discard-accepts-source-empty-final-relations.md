### Case DECISION-EVOLVE-DISCARD-SOURCE-EMPTY-001: Evolve discard 接受来源为空的最终关系
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard accepts source-empty final relations`
- `bun test --test-name-pattern="^evolve discard accepts source-empty final relations$" ./tools/decision-records/tests/run.ts`
Contract:
- 未提供关系覆盖时，所选后继使用自身来源关系；来源为空即为空最终关系，不额外要求 `--clear-relations`。
Proves:
- 关系为空的后继可与删除目标在同一事务完成。
