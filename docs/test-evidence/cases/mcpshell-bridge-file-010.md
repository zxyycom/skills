### Case MCPSHELL-BRIDGE-FILE-010: workspace put reports an SSH spawn failure as transport failure

Tests:
- `test:fe1b17d972d6e7e1b35fc4e04f204bcf9faeb452f4a4eca65c36a746e234cc51`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在本地 SSH child 无法启动时尚未发起远端提交，必须保留确定的 `transport_failure`，不能误报可能提交的 `outcome_unknown`。

Proves:
- 将 `sshExecutable` 指向不存在的绝对命令；result 为 `transport_failure`，project destination 不存在。
