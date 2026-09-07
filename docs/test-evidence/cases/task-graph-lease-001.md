### Case TASK-GRAPH-LEASE-001: 过期 lease 只通过显式恢复 claim 接管

Tests:
- `test:a968e5a5a1c20500e09bd7c238835d9ba78d8533aac9342fa81c522aeb1b6fec`

Tags:
- `task-graph`

Contract:
- 租约 ID 在全索引 running task 中唯一；时长、续期和所有权遵守固定状态机；过期 running task 只允许用旧 lease、最新 revision 与原因组成的 claim 恢复三元组写入新 lease。

Proves:
- 重复 lease、非法时长、错误或活动 lease 均被拒绝；过期 task 进入 actionable 且 nextAction 为 claim，匹配三元组后一次写入新 actor、新 lease 和递增 attempt。
