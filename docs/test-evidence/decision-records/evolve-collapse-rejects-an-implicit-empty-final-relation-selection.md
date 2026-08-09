### Case DECISION-UNRECORDED-COLLAPSE-IMPLICIT-EMPTY-001: Evolve 折叠拒绝隐式空关系选择
Entry:
- `tools/decision-records/tests/unrecorded-history.test.ts > evolve collapse rejects an implicit empty final relation selection`
- `bun test --test-name-pattern="^evolve collapse rejects an implicit empty final relation selection$" ./tools/decision-records/tests/run.ts`
Contract:
- 折叠未记录中间前序时，省略关系覆盖表示使用候选来源关系；来源关系为空不能被推断为调用方明确放弃全部上游，必须使用 `--clear-relations` 表达该意图。
Proves:
- 空关系候选在没有显式覆盖或清空时被拒绝，并得到使用 `--clear-relations` 的可行动诊断。
- 拒绝路径逐字节保留后继候选、中间记录和 decision-index.json。
