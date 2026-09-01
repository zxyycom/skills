### Case CHANGE-PLAN-CLI-NODE-SMOKE-001: 生成 Change Plan CLI 保持 Node 进程协议

Entry:
- `tools/change-plan/tests/cli.test.ts > generated Change Plan CLI preserves the Node success and failure protocol`
- `bun test --test-name-pattern="^generated Change Plan CLI preserves the Node success and failure protocol$" ./tools/change-plan/tests/run.ts`

Contract:
- 生成的 Change Plan MJS CLI 必须可由真实 Node 进程启动，并保留 success 与 failure 的 stdout/stderr 分流和退出状态。

Proves:
- 有效 `check` 以退出码 `0` 输出通过文本且 stderr 为空。
- 无效计划的 `check` 以退出码 `1` 保持 stdout 为空，并在 stderr 输出失败摘要。
