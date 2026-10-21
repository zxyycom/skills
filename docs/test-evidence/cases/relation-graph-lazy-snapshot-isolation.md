### Case RELATION-GRAPH-LAZY-SNAPSHOT-001: 相同节点的新旧快照使用独立关系图

Tests:
- `test:67e3fc91e8b1e7a3a88ad5b1b81b08ad8f37e2aba2af814b8f896d8f512b4360`

Tags:
- `graph`

Contract:
- 每个快照拥有独立访问器，相同节点身份不形成跨快照复用依据。

Proves:
- 两份节点相同而目标不同的快照取得不同图引用，分别保留各自邻接目标。
