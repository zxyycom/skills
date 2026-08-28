### Case INVESTIGATION-SNAPSHOT-REVISION-001: list filters formedAt relation type and title question text

Entry:
- `tools/investigation-report/tests/index-query.test.ts > list filters formedAt relation type and title question text`
- `bun test --test-name-pattern="^list filters formedAt relation type and title question text$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告 list 可组合形成时间、关系类型和标题或问题文本筛选。

Proves:
- 组合筛选只返回命中的报告。
