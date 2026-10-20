### Case TASK-GRAPH-DISTRIBUTION-004: portable build 不依赖 checkout 路径或祖先包

Tests:
- `test:af7a2e17efcbdcea706fcf2e566475847a5b3bbdc48ef68c31c5ed41b35f2c29`

Tags:
- `task-graph`

Contract:
- TS 生成不受 checkout 绝对路径或祖先 optional peer 影响；自有运行时、声明入口和闭包内容保持可移植。

Proves:
- 两个不同长度的独立源码检出复用显式准备的构建依赖，实际生成公开 TS、完整运行树、声明入口与声明树，逐字节相同。
- 生成内容没有检出绝对路径、祖先 supports-color fixture 或构建 debug ID；不约束实际运行时正常解析兼容宿主依赖。
