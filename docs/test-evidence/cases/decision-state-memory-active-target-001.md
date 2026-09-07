### Case DECISION-STATE-MEMORY-ACTIVE-TARGET-001: 内存来源拒绝活动关系目标

Tests:
- `test:c2102ef785f41ac688fd2961b3e2b22a3fc4064dc7b111670c4e704ca077f226`

Tags:
- `decision-records`

Contract:
- 修订关系目标必须是归档记录，内存来源同样执行此图约束。

Proves:
- 把关系目标改为 active 后构造快照，断言拒绝。
