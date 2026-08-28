### Case INVESTIGATION-EMPTY-COLLECTION-001: full validation rejects an empty report collection

Entry:
- `tools/investigation-report/tests/parsing-directory.test.ts > full validation rejects an empty report collection`
- `bun test --test-name-pattern="^full validation rejects an empty report collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- 完整报告集合至少包含一份正式报告。

Proves:
- 空目录返回 at-least-one-report 诊断。
