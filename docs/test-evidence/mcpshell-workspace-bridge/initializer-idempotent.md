### Case MCPSHELL-BRIDGE-INIT-002: initializer applies idempotently and preserves unrelated TOML bytes

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer applies idempotently and preserves unrelated TOML bytes`
- `bun test --test-name-pattern="^initializer applies idempotently and preserves unrelated TOML bytes$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- initializer 只维护带拥有标记的 MCP table；跟踪 TOML 不包含 backend 或绝对 roots，重复 apply 不复制 table。

Proves:
- 首次 apply 写入受管 table 和本机 env；无关 TOML 保留且第二次 apply 的 TOML 字节不变。
