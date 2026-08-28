### Case INVESTIGATION-RESOURCE-REVISION-001: resource byte changes do not change the report index source revision

Entry:

- `tools/investigation-report/tests/resources.test.ts > resource byte changes do not change the report index source revision`
- `bun test --test-name-pattern="^resource byte changes do not change the report index source revision$" ./tools/investigation-report/tests/run.ts`

Contract:

- 资源字节不进入报告 index source revision。

Proves:

- 在真实资源文件从 `one` 改为 `two` 后完整验证仍成功，index 的 sourceRevision 保持相同。
