### Case MCPSHELL-BRIDGE-INIT-002: initializer applies idempotently and preserves unrelated TOML bytes

Tests:
- `test:15001b3d187d5456cc73a0a964999f94046a12884f4ad22ca58896062b2a7931`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- initializer 只维护带拥有标记的 MCP table；跟踪 TOML 不包含 backend 或绝对 roots，apply 只写 action plan 中实际变化的 resource。

Proves:
- 首次 apply 为 env 和受管 registration 报告 `create` 并写入它们；无关 TOML 保留。
- 第二次 apply 为两个 resource 报告 `unchanged`、`wrote` 为 false，且 TOML 字节不变。
