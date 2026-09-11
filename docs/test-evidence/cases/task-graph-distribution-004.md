### Case TASK-GRAPH-DISTRIBUTION-004: portable build 不依赖 checkout 路径或祖先包

Tests:
- `test:af7a2e17efcbdcea706fcf2e566475847a5b3bbdc48ef68c31c5ed41b35f2c29`

Tags:
- `task-graph`

Contract:
- portable-build 只证明 Task Graph 生成入口不受 checkout 绝对路径和 checkout 依赖树外的祖先 optional peer 影响：bundle、source map、声明入口和完整声明树必须逐字节一致。
- 它不承接运行时导出、SDK 声明可消费性、Schema 或分发依赖边界；这些公共分发契约由 `TASK-GRAPH-DISTRIBUTION-001` 承接。

Proves:
- 在共同祖先目录预置 checkout 依赖树之外的 `supports-color` fixture 后，两个不同长度的隔离源码与依赖树分别执行真实生成入口；`task-graph.mjs`、`.map`、根声明和声明树仍逐字节一致，bundle 不包含祖先 fixture，且 bundle 与 source map 不保留构建相关 debug ID。
