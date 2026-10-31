### Case MCPSHELL-BRIDGE-INIT-006: initializer preserves an indented following TOML table on apply and remove

Tests:
- `test:dcd88f057ab83e50e2086b2c31d966745ee86c9fb2439600d4e0690dba6f72f0`

Tags:
- `mcpshell-workspace-bridge`

Contract:
- initializer 查找受管区间的后续 TOML table header 必须与同名 table 查找同样接受 `\n[\t ]*\[`，使 apply 与 remove 都不会吞掉合法缩进的无关 table。

Proves:
- Python `tomllib` 确认 fixture 合法；重复 apply 和 remove 后缩进的 `[mcp_servers.other]` 保留且结果仍可解析。
