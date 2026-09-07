### Case MCPSHELL-BRIDGE-INIT-005: initializer rejects an inline-comment table header without changing TOML

Tests:
- `test:c242c58d3cb2526f97008a7009c798473d867fd95441409254a3df37fb5a48c5`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- 合法 TOML table header 后带 inline `#` comment 仍是同名 registration；无 bridge 拥有标记时 initializer 必须冲突停止并保持原 TOML bytes。

Proves:
- `[mcp_servers.workspace_bridge] # existing registration` 返回 `config_conflict`，测试逐字节比较写入前后的 TOML。
