### Case DECISION-TRANSACTION-INCOMPLETE-RECOVERY-001: 决策事务报告恢复写入失败

Tests:
- `test:d8f1c17056b56527a98a87ab9421a189160820f2193a24a79d370739440b70d7`

Tags:
- `decision-records`

Contract:
- 恢复步骤再次失败时必须报告原始写入失败和定位的恢复诊断。

Proves:
- 模拟更新与恢复写入各失败一次，断言两个诊断及残留状态。
- 事务结果声明 `partial-or-unknown`，不伪称已完整恢复。
