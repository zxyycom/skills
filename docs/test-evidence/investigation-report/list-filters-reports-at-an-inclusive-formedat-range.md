### Case INVESTIGATION-SNAPSHOT-REVISION-001: list filters reports at an inclusive formedAt range

Entry:

- `tools/investigation-report/tests/index-query.test.ts > list filters reports at an inclusive formedAt range`
- `bun test --test-name-pattern="^list filters reports at an inclusive formedAt range$" ./tools/investigation-report/tests/run.ts`

Contract:

- list 的 formedAt 起止筛选包含两个端点。

Proves:

- 起止时刻的报告被返回；范围外的报告被排除。
