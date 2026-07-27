### Case DECISION-TRACE-DIRECTION-001: 决策追踪遵循前序与后继方向
Entry:
- `tools/decision-records/tests/queries.test.ts > decision trace follows predecessor and successor directions`
- `bun test --test-name-pattern="^decision trace follows predecessor and successor directions$" ./tools/decision-records/tests/run.ts`
Contract:
- Trace CLI 必须按默认、predecessors 与 successors 方向返回真实直接演进关系。
Proves:
- 默认追踪显示关系类型和两端领域，前序与后继筛选只包含对应方向的记录。
