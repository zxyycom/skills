### Case INVESTIGATION-INDEX-TEXT-FILTER-001: list filters report title and question text

Entry:

- `tools/investigation-report/tests/index-query.test.ts > list filters report title and question text`
- `bun test --test-name-pattern="^list filters report title and question text$" ./tools/investigation-report/tests/run.ts`

Contract:

- list 的 text 条件同时检索报告 title 与 question。

Proves:

- title 或 question 命中的报告被返回，不命中的报告被排除。
