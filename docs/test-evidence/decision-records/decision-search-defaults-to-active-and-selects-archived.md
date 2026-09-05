### Case DECISION-SEARCH-STATUS-001: Decision search 默认活动记录并可选择归档记录

Entry:
- `tools/decision-records/tests/queries.test.ts > decision search defaults to active and permits archived selection`
- `bun test --test-name-pattern="^decision search defaults to active and permits archived selection$" ./tools/decision-records/tests/run.ts`

Contract:
- Decision search 默认只搜索 active 决策，显式 status=archived 时搜索归档决策及其 archive sourcePath。

Proves:
- 默认查询不返回匹配的归档 Decision ID。
- archived 查询返回该 ID 和 archive 下的 sourcePath。
