### Case TASK-GRAPH-LEASE-RELEASE-001: 释放 lease 清除执行占有并应用控制

Tests:
- `test:aa6c4379335e98ccc8342a5795f039b17dac6587ec2e50215077885108abb706`

Tags:
- `task-graph`

Contract:
- release 需匹配活动 lease，并采用合法本地 control 转为空闲。

Proves:
- 非法 inherit control 被拒绝；paused release 的完整 state 保留 attempt、清除 lease 并写入期望 control/timestamps。
