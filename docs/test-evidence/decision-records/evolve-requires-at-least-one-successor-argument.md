### Case DECISION-CLI-EVOLVE-SUCCESSOR-REQUIRED-001: Evolve 要求至少一个后继参数
Entry:
- `tools/decision-records/tests/cli-args.test.ts > evolve requires at least one successor argument`
- `bun test --test-name-pattern="^evolve requires at least one successor argument$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 必须通过至少一个 `--successor` 明确完整后继集合。
Proves:
- 未提供 successor 的 evolve 调用，即使附带 `--discard`，也退出 2 并报告 required option `--successor`。
