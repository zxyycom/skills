### Case INVESTIGATION-CLI-USAGE-001: 生成 CLI 的帮助与参数错误保留退出契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation CLI usage errors preserve exit contracts`
- `bun test --test-name-pattern="^generated investigation CLI usage errors preserve exit contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 帮助请求必须成功展示各命令约束，未知选项、非法 limit 和 sync-index 过滤参数必须返回用法错误。
Proves:
- 帮助返回 0，三类参数错误稳定返回退出码 2，并保留具体 limit 诊断。
