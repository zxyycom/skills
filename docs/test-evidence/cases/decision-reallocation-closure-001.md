### Case DECISION-REALLOCATION-CLOSURE-001: Evolve 要求重划分量的完整后继集合

Tests:
- `test:8a05ce72ab31ca432d5d89b4ddd7afaae990301b9c1f7b4d76c3719787ec3f39`

Tags:
- `decision-records`

Contract:
- 重划关系的建立或修订必须选择最终连通分量中的全部已建立后继。

Proves:
- 前面存在不相交重划分量时，目标分量含第三个已建立后继而仅选择原来两个，纯事务准备返回 error、exitCode=1，诊断指出遗漏的 Decision ID，且不产生 changes。
