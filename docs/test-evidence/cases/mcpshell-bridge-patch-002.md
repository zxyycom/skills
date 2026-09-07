### Case MCPSHELL-BRIDGE-PATCH-002: workspace apply patch rejects escape paths and oversized text before SSH

Tests:
- `test:c01b6ee6f55ef9fa1b33a1eff35ba3b9a6115a88076b56a6af0057f5739ee837`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- patch 的路径与 64 KiB 文本上限必须在启动 SSH 前拒绝。

Proves:
- `..` patch path 返回 `path_rejected`；超限 patch 返回 `text_too_large`。
