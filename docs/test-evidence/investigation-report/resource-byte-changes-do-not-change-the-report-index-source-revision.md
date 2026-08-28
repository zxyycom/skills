### Case INVESTIGATION-RESOURCE-REVISION-001: resource byte changes do not change the report index source revision

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource byte changes do not change the report index source revision`
- `bun test --test-name-pattern="^resource byte changes do not change the report index source revision$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源字节不进入报告索引 source revision。

Proves:
- 修改资源字节后 sourceRevision 保持相同。
