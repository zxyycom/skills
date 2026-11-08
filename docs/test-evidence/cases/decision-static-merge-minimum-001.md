### Case DECISION-STATIC-MERGE-MINIMUM-001: 严格关系检查拒绝前序不足的纯归并

Tests:
- `test:d0e8607153957bc765119ffa5bbdf0deed94952e55c77dc41bd158408293c76f`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的纯归并关系集必须至少包含两个直接前序。

Proves:
- 以原生索引图将一条修订边改为归并边，只有一个前序时图校验失败；该节点不检查具体诊断文本。
