### Case MCPSHELL-BRIDGE-FILE-010: workspace put reports an SSH spawn failure as transport failure

Tests:
- `test:72d264d0c4dbd9613314708251539935bf0cf47c85c75d0b2274229c905b618e`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在本地 SSH child 无法启动时尚未发起远端提交，必须保留确定的 `transport_failure`，不能误报可能提交的 `outcome_unknown`。

Proves:
- 将 `sshExecutable` 指向不存在的绝对命令；result 为 `transport_failure`，project destination 不存在。
