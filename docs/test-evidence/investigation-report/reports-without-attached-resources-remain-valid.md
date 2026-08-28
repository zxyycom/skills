### Case INVESTIGATION-RESOURCE-OPTIONAL-001: reports without attached resources remain valid

Entry:
- `tools/investigation-report/tests/resources.test.ts > reports without attached resources remain valid`
- `bun test --test-name-pattern="^reports without attached resources remain valid$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告可以不声明随附资源。

Proves:
- 没有资源章节的合法报告通过验证。
