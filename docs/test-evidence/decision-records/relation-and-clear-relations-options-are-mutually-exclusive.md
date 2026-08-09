### Case DECISION-CLI-RELATION-SELECTION-001: Relation 与 clear-relations 参数互斥
Entry:
- `tools/decision-records/tests/cli-args.test.ts > relation and clear-relations options are mutually exclusive`
- `bun test --test-name-pattern="^relation and clear-relations options are mutually exclusive$" ./tools/decision-records/tests/run.ts`
Contract:
- 完整关系覆盖与显式空关系是互斥选择，同一命令不能同时使用 `--relation` 和 `--clear-relations`。
Proves:
- Activate 同时提供两个选项时退出 2，并报告 cannot be used with option。
