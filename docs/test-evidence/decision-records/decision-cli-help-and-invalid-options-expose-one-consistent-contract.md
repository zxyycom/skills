### Case DECISION-CLI-ARGS-001: CLI 帮助与参数错误暴露一致命令契约
Entry:
- `tools/decision-records/tests/queries.test.ts > decision CLI help and invalid options expose one consistent contract`
- `bun test --test-name-pattern="^decision CLI help and invalid options expose one consistent contract$" ./tools/decision-records/tests/run.ts`
Contract:
- 顶层与子命令帮助必须准确说明默认 check、候选源码查询、正式索引检查/重建和统一 evolve 协议；已移除命令、旧参数形状和非法或冲突参数继续使用退出码 2。
Proves:
- 顶层帮助公开 agent-oriented 入口、默认严格检查、候选源码语义和 evolve，且不再列出独立 split 命令。
- Evolve 帮助公开重复 `--successor` 与 `--clear-relations`，不再公开旧单后继 `--alignment`。
- 独立 split、旧 positional evolve、缺失 successor、未知选项、非法深度、非法领域 ID、缺失 activate alignment 以及同时使用 relation 与 clear-relations 均退出 2。
- Mark-aligned 与 archive 帮助继续公开事实核对和归档保留 alignment 的长期边界。
