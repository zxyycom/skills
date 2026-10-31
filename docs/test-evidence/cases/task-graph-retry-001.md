### Case TASK-GRAPH-RETRY-001: 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写

Tests:
- `test:68603c3b2f01d4197e243d2e92acd732785e962251b7afbf5efa1579318547dc`

Tags:
- `task-graph`

Contract:
- retry 仅将 failed 恢复 idle 并保留累计 attempt，成功与取消终态不可 reopen。

Proves:
- 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写。
