### Case DECISION-EVOLVE-DUPLICATE-SUCCESSOR-001: Evolve CLI 拒绝重复后继成员
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects duplicate successor members at the CLI boundary`
- `bun test --test-name-pattern="^evolve rejects duplicate successor members at the CLI boundary$" ./tools/decision-records/tests/run.ts`
Contract:
- 一次 evolve 的完整 successor 集合中，每个规范决策路径只能出现一次。
Proves:
- 同一路径重复提供两个 `--successor` 时，生成 CLI 在参数边界退出 2 并报告重复后继路径。
