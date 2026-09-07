### Case TASK-GRAPH-CLI-JSON-FLAG-001: 全局 JSON flag 可位于 task list 前后

Tests:
- `test:bc255289a36a679f81be7f3a3553c7d29e84bf25a2d3eacc86cc4b891d31d11a`

Tags:
- `task-graph`

Contract:
- --json 是全局 boolean flag，合法出现一次时可位于 task list command 前或后。

Proves:
- 两种位置都退出 0 并产生逐字节相同的单 LF JSON projection。
