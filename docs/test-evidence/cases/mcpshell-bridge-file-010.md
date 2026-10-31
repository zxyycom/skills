### Case MCPSHELL-BRIDGE-FILE-010: workspace put reports an SSH spawn failure as transport failure

Tests:
- `test:b733c6a508f5114c6b5a743d675f68a589abe7af6eba721e5cf26f28f288a0af`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在本地 SSH child 无法启动时尚未发起远端提交，必须保留确定的 `transport_failure`，不能误报可能提交的 `outcome_unknown`。

Proves:
- 将 `sshExecutable` 指向不存在的绝对命令；result 为 `transport_failure`，project destination 不存在。
