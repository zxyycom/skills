### Case TASK-GRAPH-LEASE-UUID-001: 索引内 lease UUID 不可重复

Tests:
- `test:65aa58944ed029447f353aaa43804f4b06816250fc4c31a94440205bb6469765`

Tags:
- `task-graph`

Contract:
- running lease ID 在全索引中唯一。

Proves:
- 第二任务使用已有 UUID 被 LEASE_CONFLICT 拒绝且 retryable=true，首任务完整状态不变。
