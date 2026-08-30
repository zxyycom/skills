### Case DECISION-REALLOCATION-CONNECTIVITY-001: Evolve 拒绝不连通重划图

Entry:
- `tools/decision-records/tests/evolution.test.ts > evolve rejects a disconnected reallocation graph`
- `bun test --test-name-pattern="^evolve rejects a disconnected reallocation graph$" ./tools/decision-records/tests/run.ts`

Contract:
- 单次重划的后继—前序二部图必须连通，互不相连的关系属于独立事务。

Proves:
- 两条彼此不共享端点的一对一重划边在写入前被拒绝。
