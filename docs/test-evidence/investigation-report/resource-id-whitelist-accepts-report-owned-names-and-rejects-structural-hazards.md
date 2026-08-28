### Case INVESTIGATION-RESOURCE-NAME-001: resource ID whitelist accepts report-owned names and rejects structural hazards

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource ID whitelist accepts report-owned names and rejects structural hazards`
- `bun test --test-name-pattern="^resource ID whitelist accepts report-owned names and rejects structural hazards$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源 ID 使用 owner report stem 前缀，并拒绝路径穿越等结构风险。

Proves:
- 合法 owner 资源 ID 通过，穿越目标无效。
