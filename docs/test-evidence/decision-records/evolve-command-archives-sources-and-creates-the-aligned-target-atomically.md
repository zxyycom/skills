### Case DECISION-EVOLVE-COMMAND-001: Evolve 原子归档来源并创建目标
Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve command archives sources and creates the aligned target atomically`
- `bun test --test-name-pattern="^evolve command archives sources and creates the aligned target atomically$" ./tools/decision-records/tests/run.ts`
Contract:
- Evolve 命令必须在一次操作中归档来源决策并创建对齐目标。
Proves:
- 成功后全部活动直接前序成为 archived，新目标成为 aligned active 并保存完整关系集合。
