### Case INVESTIGATION-RESOURCE-GIT-VISIBILITY-001: report resource link changes stale the current index

Entry:

- `tools/investigation-report/tests/resources.test.ts > report resource link changes stale the current index`
- `bun test --test-name-pattern="^report resource link changes stale the current index$" ./tools/investigation-report/tests/run.ts`

Contract:

- 资源链接属于报告 Markdown source；仅资源字节不属于 source revision。

Proves:

- 将报告链接改为另一合法资源后，完整验证报告当前 index 已过期。
