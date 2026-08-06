### Case DECISION-CLI-ARGS-001: CLI 帮助与参数错误暴露一致命令契约
Entry:
- `tools/decision-records/tests/queries.test.ts > decision CLI help and invalid options expose one consistent contract`
- `bun test --test-name-pattern="^decision CLI help and invalid options expose one consistent contract$" ./tools/decision-records/tests/run.ts`
Contract:
- 顶层与子命令帮助必须准确说明默认 check、候选源码查询、正式索引检查/重建、只有完整方向成为当前事实并完成核对后才能对齐，以及归档保留对齐状态；非法参数继续使用参数错误退出契约。
Proves:
- 帮助文本公开 agent-oriented 入口、默认严格检查、`candidates` 与 `show-candidate` 的源码语义、sync-index 的只检/写入差异、mark-aligned 的事实基线语义和归档保留 alignment；未知选项、非法深度、非法领域 ID 与缺失必需参数均退出 2。
