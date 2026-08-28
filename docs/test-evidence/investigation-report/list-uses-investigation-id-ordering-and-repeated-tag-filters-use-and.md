### Case INVESTIGATION-INDEX-QUERY-001: list uses Investigation ID ordering and repeated tag filters use AND

Entry:
- `tools/investigation-report/tests/index-query.test.ts > list uses Investigation ID ordering and repeated tag filters use AND`
- `bun test --test-name-pattern="^list uses Investigation ID ordering and repeated tag filters use AND$" ./tools/investigation-report/tests/run.ts`

Contract:
- 报告 list 按 Investigation ID 确定性排序，重复 tag 条件使用 AND。

Proves:
- 两个 tag 条件只返回同时具有两者的报告。
