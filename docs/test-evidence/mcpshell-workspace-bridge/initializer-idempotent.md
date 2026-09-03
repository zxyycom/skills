### Case MCPSHELL-BRIDGE-INIT-002: initializer applies idempotently and preserves unrelated TOML bytes

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer applies idempotently and preserves unrelated TOML bytes`
- `bun test --test-name-pattern="^initializer applies idempotently and preserves unrelated TOML bytes$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- initializer 只维护带拥有标记的 MCP table；跟踪 TOML 不包含 backend 或绝对 roots，apply 只写 action plan 中实际变化的 resource。

Proves:
- 首次 apply 为 env 和受管 registration 报告 `create` 并写入它们；无关 TOML 保留。
- 第二次 apply 为两个 resource 报告 `unchanged`、`wrote` 为 false，且 TOML 字节不变。
