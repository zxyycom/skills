### Case MCPSHELL-BRIDGE-FILE-010: workspace put reports an SSH spawn failure as transport failure

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace put reports an SSH spawn failure as transport failure`
- `bun test --test-name-pattern="^workspace put reports an SSH spawn failure as transport failure$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- put 在本地 SSH child 无法启动时尚未发起远端提交，必须保留确定的 `transport_failure`，不能误报可能提交的 `outcome_unknown`。

Proves:
- 将 `sshExecutable` 指向不存在的绝对命令；result 为 `transport_failure`，project destination 不存在。
