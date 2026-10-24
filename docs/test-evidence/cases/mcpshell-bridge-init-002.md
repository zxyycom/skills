### Case MCPSHELL-BRIDGE-INIT-002: initializer applies idempotently and preserves unrelated TOML bytes

Tests:
- `test:15001b3d187d5456cc73a0a964999f94046a12884f4ad22ca58896062b2a7931`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- initializer 只维护带拥有标记的 MCP table；跟踪 TOML 不包含 backend 或绝对 roots，apply 只写 action plan 中实际变化的 resource。

Proves:
- 首次 apply 后完整 unrelated TOML 前缀（comments/model/other table）逐字保留；二次 apply 保持幂等且不重复 owned 配置。
