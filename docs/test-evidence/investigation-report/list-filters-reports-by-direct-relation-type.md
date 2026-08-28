### Case INVESTIGATION-INDEX-RELATION-FILTER-001: list filters reports by direct relation type

Entry:

- `tools/investigation-report/tests/index-query.test.ts > list filters reports by direct relation type`
- `bun test --test-name-pattern="^list filters reports by direct relation type$" ./tools/investigation-report/tests/run.ts`

Contract:

- list 的 relation-type 只匹配报告声明的直接关系类型。

Proves:

- 仅带有请求类型关系的报告出现在查询结果中。
