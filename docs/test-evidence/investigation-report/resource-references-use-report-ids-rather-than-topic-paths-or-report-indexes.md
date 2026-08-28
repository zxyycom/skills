### Case INVESTIGATION-RESOURCE-OWNER-PREFIX-001: resource references use report IDs rather than topic paths or report indexes

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource references use report IDs rather than topic paths or report indexes`
- `bun test --test-name-pattern="^resource references use report IDs rather than topic paths or report indexes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 使用 Investigation ID stem，不使用已取消的路径或索引位置。

Proves:
- 资源 owner ID 可反推为带 `.md` 的报告 ID。
