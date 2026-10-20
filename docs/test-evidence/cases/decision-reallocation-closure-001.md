### Case DECISION-REALLOCATION-CLOSURE-001: Evolve 要求重划分量的完整后继集合

Tests:
- `test:89a6aafebddb4323e28dc06711553b96bc8fe3cecb37b18771cf7a8399d3f0f2`

Tags:
- `decision-records`

Contract:
- 重划关系的建立或修订必须选择最终连通分量中的全部已建立后继。

Proves:
- 内存来源包含第三个已建立连通后继而仅选择原来两个时，纯事务准备返回 error、exitCode=1，诊断指出遗漏的 Decision ID，且不产生 changes。
