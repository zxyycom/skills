### Case TASK-GRAPH-CLI-STDOUT-FAULT-001: Process CLI 的 stdout fault 只进入 stderr

Tests:
- `test:c051ec0ab9bb31c2dc7a95dc189e9dc9f2edadf8fd946895ee8563c9bd776adc`

Tags:
- `task-graph`

Contract:
- 未处理的 stdout 写入 fault 不得伪装成领域结果或污染 stdout；process 边界负责 stderr 和 exit 2。

Proves:
- 模拟 stdout.write 抛错时 stdout 为空、stderr 包含错误且退出 2。
