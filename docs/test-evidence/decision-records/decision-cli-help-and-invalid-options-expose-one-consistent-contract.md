### Case DECISION-CLI-ARGS-001: CLI 帮助与参数错误暴露一致命令契约
Entry:
- `tools/decision-records/tests/queries.test.ts > decision CLI help and invalid options expose one consistent contract`
- `bun test --test-name-pattern="^decision CLI help and invalid options expose one consistent contract$" ./tools/decision-records/tests/run.ts`
Contract:
- 顶层与子命令帮助必须准确说明默认 check、索引检查/重建和归档执行状态语义；非法参数继续使用参数错误退出契约。
Proves:
- 帮助文本公开 agent-oriented 入口、默认严格检查、sync-index 的只检/写入差异和归档保留 alignment；未知选项、非法深度、非法领域 ID 与缺失必需参数均退出 2。
