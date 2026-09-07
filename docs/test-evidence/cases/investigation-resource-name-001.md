### Case INVESTIGATION-RESOURCE-NAME-001: resource ID whitelist accepts report-owned names and rejects structural hazards

Tests:
- `test:a76f028c7d906fd67bc201d3f77419c03682670f1f576741d25cc4b3588df258`

Tags:
- `investigation-report`

Contract:
- 资源 ID 使用 extensionless Investigation ID 前缀，并拒绝路径穿越等结构风险。

Proves:
- 合法 owner 资源 ID 通过，穿越目标无效。
