### Case DECISION-REALLOCATION-CONNECTIVITY-001: Evolve 拒绝不连通重划图

Tests:
- `test:a2256d7706b7b5ae15ce28ff2adeeadfec68a30b6a292f7d1ba4ed229d4e6f1a`

Tags:
- `decision-records`

Contract:
- 单次重划的后继—前序二部图必须连通，互不相连的关系属于独立事务。

Proves:
- 两条彼此不共享端点的一对一重划边在写入前被拒绝。
