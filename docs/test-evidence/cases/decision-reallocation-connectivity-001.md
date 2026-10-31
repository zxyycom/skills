### Case DECISION-REALLOCATION-CONNECTIVITY-001: Evolve 拒绝不连通重划图

Tests:
- `test:9074d9c270b1d7f90f2441d13a92e7286432ba2a9110689b13be5881f2afb0c3`

Tags:
- `decision-records`

Contract:
- 单次重划的后继—前序二部图必须连通，互不相连的关系属于独立事务。

Proves:
- 纯事务准备对彼此不共享端点的两条一对一重划边返回 error、exitCode=1 和二部图须连通的诊断，且不产生 changes。
