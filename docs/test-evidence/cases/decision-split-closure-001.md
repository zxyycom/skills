### Case DECISION-SPLIT-CLOSURE-001: 严格关系检查拒绝开放拆分

Tests:
- `test:d0e8607153957bc765119ffa5bbdf0deed94952e55c77dc41bd158408293c76f`

Tags:
- `decision-records`

Contract:
- 已建立关系图中的拆分必须形成至少两个指向同一直接前序的后继。

Proves:
- 以原生索引图将一条修订边改为拆分边，只有一个后继时图校验失败；该节点不检查具体诊断文本。
