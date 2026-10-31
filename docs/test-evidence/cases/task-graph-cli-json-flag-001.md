### Case TASK-GRAPH-CLI-JSON-FLAG-001: 全局 JSON flag 可位于 task list 前后

Tests:
- `test:2ee89aedccdb1a025d119fa53ff8cc278efe4df168c1d0fae487be4c46071d51`

Tags:
- `task-graph`

Contract:
- --json 是全局 boolean flag，合法出现一次时可位于 task list command 前或后。

Proves:
- 两种位置都退出 0 并产生逐字节相同的单 LF JSON projection。
