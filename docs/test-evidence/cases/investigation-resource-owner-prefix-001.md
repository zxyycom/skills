### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: resource references use report IDs rather than topic paths or report indexes

Tests:
- `test:d5ae377faf8d4c12bd2006afe9a5c2f8806a4227077d58b76f62f5cba917841b`

Tags:
- `investigation-report`

Contract:
- 资源 ID 使用 extensionless Investigation ID 作为 owner 前缀，不使用路径或索引位置。

Proves:
- 资源 owner ID 可反推为 extensionless 的报告 ID。
