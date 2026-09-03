### Case MCPSHELL-BRIDGE-INIT-007: initializer keeps a prelude newline before an indented following table on remove

Entry:
- `tools/mcpshell-workspace-bridge/tests/initializer.test.ts > initializer keeps a prelude newline before an indented following table on remove`
- `bun test --test-name-pattern="^initializer keeps a prelude newline before an indented following table on remove$" ./tools/mcpshell-workspace-bridge/tests/run.ts`

Contract:
- 删除受管 table 时，若其前有无关 prelude、其后有合法缩进 TOML table，splice 必须保留两者之间独立的 newline，不能把 table header 拼到 prelude 行。

Proves:
- `# prelude`、owned table 与缩进 `[mcp_servers.other]` 的 fixture 在 remove 后逐字节为两行独立结构，Python `tomllib` 仍可解析。
