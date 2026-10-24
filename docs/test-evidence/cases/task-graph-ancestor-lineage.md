### Case TASK-GRAPH-ANCESTOR-LINEAGE-001: 深链祖先返回完整近优先序列

Tests:
- `test:4b4b27a02a78e47e4f984022c1f345e3e28e94bb7d4b3940500bdd10f7e8b5b4`

Tags:
- `task-graph`

Contract:
- 祖先遍历返回从直接父到根的完整有序 lineage，不以实现递归栈作为产品深度限制。

Proves:
- 既有 8000 层回归样本精确返回 7999 个 nearest-first 祖先；该样本不是公开容量或真实 Node 栈验收声明。
