### Case DECISION-REALLOCATION-CONNECTIVITY-001: Evolve 拒绝不连通重划图

Tests:
- `test:05115fda4c496e4bd80297340a946fd2081dba3b90063c4422282cf1d548899b`

Tags:
- `decision-records`

Contract:
- 单次重划的后继—前序二部图必须连通，互不相连的关系属于独立事务。

Proves:
- 两条彼此不共享端点的一对一重划边在写入前被拒绝。
