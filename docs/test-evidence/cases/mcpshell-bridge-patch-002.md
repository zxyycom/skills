### Case MCPSHELL-BRIDGE-PATCH-002: workspace apply patch rejects escape paths and oversized text before SSH

Tests:
- `test:90e0f0a99f0f9d15fe6700f0d75e37addf9d214685a192aa87fbbb2b68113082`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- patch 的路径与 64 KiB 文本上限必须在启动 SSH 前拒绝。

Proves:
- `..` patch path 返回 `path_rejected`；超限 patch 返回 `text_too_large`。
