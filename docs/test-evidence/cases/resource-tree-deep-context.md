### Case RESOURCE-TREE-DEEP-CONTEXT-001: 深层树保留实际祖先及深度

Tests:
- `test:2b46235e13163617def47b7facc8b2583bdedea1247361b4e6fb34c35d6d83d5`

Tags:
- `resource-records`

Contract:
- 树视图允许限制视觉缩进，但不能据此裁剪祖先路径或降低标记的实际深度。

Proves:
- 42 个集合形成一条链；窗口只命中最深集合，树按路径给出深度 0 至 40 的 41 个具名祖先上下文，并将命中标为深度 41。不锁定实际缩进宽度。
