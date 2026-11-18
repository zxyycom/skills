### Case RESOURCE-TREE-DEEP-CONTEXT-001: 深层树保留实际祖先及深度

Tests:
- `test:2b46235e13163617def47b7facc8b2583bdedea1247361b4e6fb34c35d6d83d5`

Tags:
- `resource-records`

Contract:
- 树视图允许限制视觉缩进，但不能据此裁剪祖先路径或降低标记的实际深度。

Proves:
- 私有集合链中，限制一条命中的树仍列出深度 0 至 40 的 41 个祖先上下文，并将资源标记为深度 41。
