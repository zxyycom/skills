### Case RELATION-GRAPH-LAZY-SHARING-001: 同一访问器的图操作复用首次构建结果

Tests:
- `test:6b4230f97cadcc8bfa4ff5b67faa3f00a8eaee23762e7a37d67b33c470b004a4`

Tags:
- `graph`

Contract:
- 同一不可变关系快照的结构校验与追踪共用首次构建的关系图。

Proves:
- 连续校验与追踪后，图引用保持相同、构建次数为一，追踪成员为预期两节点。
