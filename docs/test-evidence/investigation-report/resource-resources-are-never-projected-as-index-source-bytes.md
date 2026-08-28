### Case INVESTIGATION-RESOURCE-MEMBERSHIP-001: resource resources are never projected as index source bytes

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource resources are never projected as index source bytes`
- `bun test --test-name-pattern="^resource resources are never projected as index source bytes$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告索引 state 不投影资源字节。

Proves:
- 持久化报告 state 不含 `resourceBytes`。
