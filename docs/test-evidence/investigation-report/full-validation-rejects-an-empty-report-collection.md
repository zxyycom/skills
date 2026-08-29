### Case INVESTIGATION-EMPTY-COLLECTION-001: full validation rejects an empty report collection

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects an empty report collection`
- `bun test --test-name-pattern="^full validation rejects an empty report collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 没有当前派生索引的新建空报告目录不得被视为已建立集合。

Proves:
- 新建空目录返回 at-least-one-report 诊断。
