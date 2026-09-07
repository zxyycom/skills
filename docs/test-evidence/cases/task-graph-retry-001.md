### Case TASK-GRAPH-RETRY-001: 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写

Tests:
- `test:b1d6d5e3d48dab4c83fd762a5622637b16e6d9517e034dbb63b23310e98723a0`

Tags:
- `task-graph`

Contract:
- retry 仅将 failed 恢复 idle 并保留累计 attempt，成功与取消终态不可 reopen。

Proves:
- 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写。
