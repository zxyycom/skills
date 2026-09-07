### Case DECISION-REALLOCATION-CLOSURE-001: Evolve 要求重划分量的完整后继集合

Tests:
- `test:bab84b7da9c6f92c70b878d9ccc7604a59a1484592bb3be47b2172a4a819d194`

Tags:
- `decision-records`

Contract:
- 重划关系的建立或修订必须选择最终连通分量中的全部已建立后继。

Proves:
- 已建立第三个连通后继后，仅选择原来的两个后继时，evolve 报告遗漏的 Decision ID。
