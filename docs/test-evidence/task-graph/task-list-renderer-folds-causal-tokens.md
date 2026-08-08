### Case TASK-GRAPH-LIST-FOLDING-001: 全部补充因果 blocker 确定性进入 blocked-by

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer displays every causal blocker kind in deterministic order`
- `bun test --test-name-pattern="^task-list renderer displays every causal blocker kind in deterministic order$" ./tools/task-graph/tests/run.ts`

Contract:
- all-children-cancelled、ancestor-terminal、dependency-cancelled、dependency-failed 与 descendant-lease 都折叠为补充因果 token。

Proves:
- 五种 causal blocker 无论输入顺序都按 kind 与 related task ID 确定性输出到 blocked-by。
