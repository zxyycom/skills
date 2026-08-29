### Case DECISION-CLI-ARGS-001: CLI 顶层帮助公开当前命令集合
Entry:
- `tools/decision-records/tests/cli-args.test.ts > decision CLI top-level help exposes the current command set`
- `bun test --test-name-pattern="^decision CLI top-level help exposes the current command set$" ./tools/decision-records/tests/run.ts`
Contract:
- 顶层帮助必须准确公开默认 check、候选源码查询、直接重建正式索引和统一 evolve 协议，且不再公开独立 split 命令。
Proves:
- 顶层帮助包含 agent-oriented 入口、默认严格检查、候选源码发现、直接重建索引、show-candidate 与 evolve 说明。
- 顶层命令列表不包含独立 split 命令。
