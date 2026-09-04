### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: resource references use report IDs rather than topic paths or report indexes

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource references use report IDs rather than topic paths or report indexes`
- `bun test --test-name-pattern="^resource references use report IDs rather than topic paths or report indexes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 使用 extensionless Investigation ID 作为 owner 前缀，不使用路径或索引位置。

Proves:
- 资源 owner ID 可反推为 extensionless 的报告 ID。
