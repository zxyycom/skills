### Case TASK-GRAPH-LIST-FOLDING-001: 全部补充因果 blocker 确定性进入 blocked-by

Tests:
- `test:9e75acf0cef1c6b71b71af9f19cc5ec29e4393db4dae378ee3973ffc03488651`

Tags:
- `task-graph`

Contract:
- all-children-cancelled、ancestor-terminal、dependency-cancelled、dependency-failed 与 descendant-lease 都折叠为补充因果 token。

Proves:
- 五种 causal blocker 无论输入顺序都按 kind 与 related task ID 确定性输出到 blocked-by。
