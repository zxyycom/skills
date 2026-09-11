### Case TASK-GRAPH-RETRY-001: 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写

Tests:
- `test:ae9ed9f1650d925f693c4e74c9723f53b5cb7be670a2c1984b52c2e1ac5de159`

Tags:
- `task-graph`

Contract:
- retry 仅将 failed 恢复 idle 并保留累计 attempt，成功与取消终态不可 reopen。

Proves:
- 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写。
