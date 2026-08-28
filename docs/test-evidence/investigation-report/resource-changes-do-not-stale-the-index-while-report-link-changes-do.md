### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: resource changes do not stale the index while report link changes do

Entry:
- `tools/investigation-report/tests/resources.test.ts > resource changes do not stale the index while report link changes do`
- `bun test --test-name-pattern="^resource changes do not stale the index while report link changes do$" ./tools/investigation-report/tests/run.ts`

Contract:
- 资源内容变化不使索引过期；报告资源链接仍属于报告 source。

Proves:
- 资源字节变化后完整验证保持成功。
