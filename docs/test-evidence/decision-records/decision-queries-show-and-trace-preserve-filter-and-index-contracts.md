### Case DECISION-QUERIES-TRACE-001: 决策查询、展示与追踪保持契约

Entry:
- `tools/decision-records/tests/queries.test.ts > decision queries, show, and trace preserve filter and index contracts`
- `bun test --test-name-pattern="^decision queries, show, and trace preserve filter and index contracts$" ./tools/decision-records/tests/run.ts`

Contract:
- 决策 query、show 和 trace 必须共享筛选与索引身份语义。

Proves:
- 各入口返回一致决策集合、关系和诊断。
