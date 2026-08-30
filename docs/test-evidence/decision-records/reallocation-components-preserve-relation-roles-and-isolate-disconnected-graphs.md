### Case DECISION-REALLOCATION-GRAPH-001: 重划分量保留角色并隔离断连图

Entry:
- `tools/decision-records/tests/relation-validation.test.ts > reallocation components preserve relation roles and isolate disconnected graphs`
- `bun test --test-name-pattern="^reallocation components preserve relation roles and isolate disconnected graphs$" ./tools/decision-records/tests/run.ts`

Contract:
- 重划关系图必须以直接前序和直接后继的二部角色计算连通分量，且断连事件不得合并。

Proves:
- 共享一个前序的稀疏后继归入同一分量，并保留各自的前序与后继角色集合。
- 没有共享关系路径的重划边形成独立分量。
