### Case MCPSHELL-BRIDGE-FILE-011: workspace put rejects an initial physical parent outside the project

Tests:
- `test:2a27722efd7a83e2acb48dce2af5463160ecdbafdd4c7880bb1565b3d9e46979`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- put 在 remote physical destination parent 的初始 containment 检查失败时，尚未创建或提交 temporary，必须返回确定的 `path_rejected`，不能落入 commit-ack 的 `outcome_unknown`。

Proves:
- fixture 将 project 内 `link` 指向 `../outside`；`link/escaped.txt` 返回 `path_rejected` 和稳定 diagnostic，outside 不出现 destination。
