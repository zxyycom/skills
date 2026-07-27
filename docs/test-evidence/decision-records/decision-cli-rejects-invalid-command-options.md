### Case DECISION-CLI-ARGS-001: 决策 CLI 拒绝非法命令选项
Entry:
- `tools/decision-records/tests/queries.test.ts > decision CLI rejects invalid command options`
- `bun test --test-name-pattern="^decision CLI rejects invalid command options$" ./tools/decision-records/tests/run.ts`
Contract:
- 决策 CLI 必须对未知选项、非法深度、非法领域 ID 和缺失必需参数使用参数错误退出契约。
Proves:
- 每种非法命令均退出 2，并在 stderr 返回对应可行动诊断。
