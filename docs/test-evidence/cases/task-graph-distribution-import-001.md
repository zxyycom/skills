### Case TASK-GRAPH-DISTRIBUTION-IMPORT-001: Node 导入不输出 CLI 文本或创建工具 home

Tests:
- `test:0d46f7a0449023f0c9ac30fd8244b12382d2a256cffead47fe77cf805e45088c`

Tags:
- `task-graph`

Contract:
- 支持的 Node 下导入分发模块不运行 CLI 输出，也不创建指定 tool home。

Proves:
- 空 tool home 场景实际 Node import 的 stdout/stderr 均为空，指定 home 仍不存在；不声称进程全局零副作用。
