### Case TASK-GRAPH-CLI-STDOUT-FAULT-001: Process CLI 的 stdout fault 只进入 stderr

Tests:
- `test:265cfedbf2c59b9c8f43237f7b2a00b9952c7e0bdb06b0e354155135f354db78`

Tags:
- `task-graph`

Contract:
- 未处理的 stdout 写入 fault 不得伪装成领域结果或污染 stdout；process 边界负责 stderr 和 exit 2。

Proves:
- 模拟 stdout.write 抛错时 stdout 为空、stderr 包含错误且退出 2。
