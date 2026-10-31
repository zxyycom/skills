### Case TASK-GRAPH-LIST-FOLDING-001: 全部补充因果 blocker 确定性进入 blocked-by

Tests:
- `test:c205d90333f5c4431cd2abe1295817c94fb871fc0a99abf347995253487735a1`

Tags:
- `task-graph`

Contract:
- all-children-cancelled、ancestor-terminal、dependency-cancelled、dependency-failed 与 descendant-lease 都折叠为补充因果 token。

Proves:
- 五种 causal blocker 无论输入顺序都按 kind 与 related task ID 确定性输出到 blocked-by。
