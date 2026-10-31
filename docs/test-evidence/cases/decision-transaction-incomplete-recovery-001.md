### Case DECISION-TRANSACTION-INCOMPLETE-RECOVERY-001: 决策事务报告恢复写入失败

Tests:
- `test:cc9f299fa01225a71af83d8b9d2853c5ff2a024d2a5e95fe1aa1fe55915e7393`

Tags:
- `decision-records`

Contract:
- 恢复步骤再次失败时必须报告原始写入失败和定位的恢复诊断。

Proves:
- 模拟更新与恢复写入各失败一次，断言两个诊断及残留状态。
- 事务结果声明 `partial-or-unknown`，不伪称已完整恢复。
