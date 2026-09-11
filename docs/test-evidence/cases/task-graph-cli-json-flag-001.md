### Case TASK-GRAPH-CLI-JSON-FLAG-001: 全局 JSON flag 可位于 task list 前后

Tests:
- `test:5635311154c6aba34ed825d312e0caccb5b0e3f7ba2b1aee63a140f172bffd07`

Tags:
- `task-graph`

Contract:
- --json 是全局 boolean flag，合法出现一次时可位于 task list command 前或后。

Proves:
- 两种位置都退出 0 并产生逐字节相同的单 LF JSON projection。
