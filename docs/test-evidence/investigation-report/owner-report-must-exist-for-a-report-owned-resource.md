### Case INVESTIGATION-RESOURCE-INVALID-OWNER-ANCHOR-001: owner report must exist for a report-owned resource

Entry:
- `tools/investigation-report/tests/resources.test.ts > owner report must exist for a report-owned resource`
- `bun test --test-name-pattern="^owner report must exist for a report-owned resource$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 声明的 owner report 必须存在。

Proves:
- 缺少 owner report 返回错误。
