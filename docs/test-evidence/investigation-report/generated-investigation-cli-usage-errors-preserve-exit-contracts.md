### Case INVESTIGATION-CLI-USAGE-001: 生成 CLI 的帮助与参数错误保留退出契约
Entry:
- `tools/investigation-report/tests/cli-generated.test.ts > generated investigation CLI usage errors preserve exit contracts`
- `bun test --test-name-pattern="^generated investigation CLI usage errors preserve exit contracts$" ./tools/investigation-report/tests/run.ts`
Contract:
- 帮助请求必须成功展示可选随附资源、完整资源池检查及各命令约束，未知选项、非法 limit 和 sync-index 过滤参数必须返回用法错误。
Proves:
- 帮助返回 0，只向 stdout 说明局部与完整资源边界，stderr 为空。
- 未知选项、非法 limit 和 sync-index 过滤参数都返回退出码 2、保持 stdout 为空，并分别在 stderr 给出未知选项、整数 limit 或该命令不接受过滤与分页的可行动诊断。
