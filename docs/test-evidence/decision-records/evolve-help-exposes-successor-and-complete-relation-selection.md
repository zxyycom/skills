### Case DECISION-CLI-EVOLVE-HELP-001: Evolve 帮助公开后继与完整关系选择
Entry:
- `tools/decision-records/tests/cli-args.test.ts > evolve help exposes successor and complete relation selection`
- `bun test --test-name-pattern="^evolve help exposes successor and complete relation selection$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 帮助必须公开重复 successor、完整关系覆盖和显式空关系选择，且不再公开旧单后继 alignment 参数。
Proves:
- `evolve --help` 包含 `--successor`、`--clear-relations` 与完整最终关系集语义。
- 帮助不包含旧 `--alignment <value>` 参数。
