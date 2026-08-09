### Case DECISION-UNRECORDED-COLLAPSE-EMPTY-001: Evolve 折叠接受显式空的最终关系集合
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse accepts an explicitly empty final relation set`
- `bun test --test-name-pattern="^evolve collapse accepts an explicitly empty final relation set$" ./tools/decision-records/tests/run.ts`
Contract:
- `--clear-relations` 明确表示折叠后的后继不承接中间记录的任何上游，是空最终关系集合的唯一无歧义入口。
Proves:
- 带 `--clear-relations` 的单候选折叠成功删除未进入 Git HEAD 的中间记录。
- 建立后的后继拥有空关系集合。
