### Case DECISION-QUERY-INDEX-MEMBERSHIP-001: 决策查询拒绝缺失或多余的索引成员
Entry:
- `tools/decision-records/tests/queries.test.ts > decision queries reject incomplete or extra index membership`
- `bun test --test-name-pattern="^decision queries reject incomplete or extra index membership$" ./tools/decision-records/tests/run.ts`
Contract:
- List、show 与 trace 查询不得使用成员集合不等于全部已建立 Markdown 的索引。
Proves:
- 删除合法索引成员或注入额外成员时，三个查询入口都退出 1、stdout 为空并报告成员不一致。
