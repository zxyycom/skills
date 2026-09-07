### Case MCPSHELL-BRIDGE-DIST-001: generated bridge modules import without configuration side effects

Tests:
- `test:8dc6273cd02bc7c53076bf7ced7d40f45f8d2ca68f62162d44d6f4b455ee9dd6`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 分发 `.mjs` 可被 Node import，不读 env、不执行 CLI 且不产生写入副作用。

Proves:
- initializer 与 runtime module 都在独立 Node import 进程中以 status 0 结束。
