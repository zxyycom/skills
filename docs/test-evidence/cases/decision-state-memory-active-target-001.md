### Case DECISION-STATE-MEMORY-ACTIVE-TARGET-001: 内存来源拒绝活动关系目标

Tests:
- `test:3863c3af2379c7671bc0a6743626cbe9ef35f42f6c2377746b556575fd79a4f3`

Tags:
- `decision-records`

Contract:
- 修订关系目标必须是归档记录，内存来源同样执行此图约束。

Proves:
- 把关系目标改为 active 后构造快照，断言拒绝。
