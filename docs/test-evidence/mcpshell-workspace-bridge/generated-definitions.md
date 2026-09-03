### Case MCPSHELL-BRIDGE-DIST-002: generated MCPShell definitions expose the four fixed-root operations

Entry:
- `tools/mcpshell-workspace-bridge/tests/generated.test.ts > generated MCPShell definitions expose the four fixed-root operations`
- `bun test --test-name-pattern="^generated MCPShell definitions expose the four fixed-root operations$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 分发 YAML 必须定义四项固定根 operation，不暴露 backend 或 project root 日常参数。

Proves:
- YAML 的 tool names 精确为 shell、apply-patch、put、get，file replace 默认 false。
