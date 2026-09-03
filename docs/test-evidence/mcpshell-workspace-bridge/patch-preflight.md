### Case MCPSHELL-BRIDGE-PATCH-002: workspace apply patch rejects escape paths and oversized text before SSH

Entry:
- `tools/mcpshell-workspace-bridge/tests/runtime.test.ts > workspace apply patch rejects escape paths and oversized text before SSH`
- `bun test --test-name-pattern="^workspace apply patch rejects escape paths and oversized text before SSH$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- patch 的路径与 64 KiB 文本上限必须在启动 SSH 前拒绝。

Proves:
- `..` patch path 返回 `path_rejected`；超限 patch 返回 `text_too_large`。
