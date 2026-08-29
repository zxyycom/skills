### Case DECISION-EVOLVE-DISCARD-ARCHIVED-RELATION-001: Evolve discard 接受合法的无关 archived 最终关系
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve discard accepts an unrelated archived final relation`
- `bun test --test-name-pattern="^evolve discard accepts an unrelated archived final relation$" ./tools/decision-records/tests/run.ts`
Contract:
- `evolve --discard` 不增加删除专属的前序边界；只要最终图合法，后继可指向合法 archived 前序。
Proves:
- 事务删除目标并保留调用方选择的 archived 最终关系。
