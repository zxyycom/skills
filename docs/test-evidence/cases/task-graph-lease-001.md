### Case TASK-GRAPH-LEASE-001: 过期 lease 只通过显式恢复 claim 接管

Tests:
- `test:8a14afbf9656634900e6000381787055a4cc65b588a007bddd6525301575233e`

Tags:
- `task-graph`

Contract:
- 租约 ID 在全索引 running task 中唯一；时长、续期和所有权遵守固定状态机；过期 running task 只允许用旧 lease、最新 revision 与原因组成的 claim 恢复三元组写入新 lease。

Proves:
- 重复 lease、非法时长、错误或活动 lease 均被拒绝；过期 task 进入 actionable 且 nextAction 为 claim，匹配三元组后一次写入新 actor、新 lease 和递增 attempt。
