### Case MCPSHELL-BRIDGE-PATCH-002: workspace apply patch rejects escape paths and oversized text before SSH

Tests:
- `test:6b6df15a2ae72656569fc6909b8755e4f6979b53c26f773a122a67c1331999a4`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- patch 的路径与 64 KiB 文本上限必须在启动 SSH 前拒绝。

Proves:
- escape path 与 oversized text 返回本地拒绝；独立 SSH calls 文件均为空，同 fixture 的正向真实 Git patch 节点确认该记录机制健康。
