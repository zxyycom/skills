### Case DECISION-REALLOCATION-CONNECTIVITY-001: Evolve 拒绝不连通重划图

Tests:
- `test:05115fda4c496e4bd80297340a946fd2081dba3b90063c4422282cf1d548899b`

Tags:
- `decision-records`

Contract:
- 单次重划的后继—前序二部图必须连通，互不相连的关系属于独立事务。

Proves:
- 纯事务准备对彼此不共享端点的两条一对一重划边返回 error、exitCode=1 和二部图须连通的诊断，且不产生 changes。
