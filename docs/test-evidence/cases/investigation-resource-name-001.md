### Case INVESTIGATION-RESOURCE-NAME-001: resource ID whitelist accepts report-owned names and rejects structural hazards

Tests:
- `test:1f3c882378a9e723a5fd1c0abddb14ea46bf36ac4ba6bbf8d033b53e44611d89`

Tags:
- `investigation-report`

Contract:
- 资源 ID 使用 extensionless Investigation ID 前缀，并拒绝路径穿越等结构风险。

Proves:
- 合法 owner 资源 ID 通过，穿越目标无效。
