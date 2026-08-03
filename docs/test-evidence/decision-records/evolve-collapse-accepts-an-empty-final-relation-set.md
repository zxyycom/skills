### Case DECISION-UNRECORDED-COLLAPSE-EMPTY-001: Evolve 折叠接受空的最终关系集合
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse accepts an empty final relation set`
- `bun test --test-name-pattern="^evolve collapse accepts an empty final relation set$" ./tools/decision-records/tests/run.ts`
Contract:
- 折叠调用中的零个或多个 `--relation` 共同构成后继的完整最终关系集合；调用者可以明确不承接中间记录的任何上游。
Proves:
- 不提供 `--relation` 的显式折叠成功删除未提交中间记录。
- 建立后的后继关系集合为空，不会自动继承中间记录的上游。
