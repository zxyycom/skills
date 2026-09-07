### Case DECISION-TRANSACTION-MOVE-001: 移动事务在索引替换失败后恢复

Tests:
- `test:e363e03ec23d8726a7336cbb7a796f6f79ccb704f57150b5d345609d851dc915`

Tags:
- `decision-records`

Contract:
- 移动事务在索引替换后的写入失败中必须恢复源路径、目标路径与原索引。

Proves:
- 在原子 index rename 已完成后注入 `EIO`，事务报告受控失败详情，并恢复源文件和原 index，archive 目标不存在。
- 事务结果声明 `rolled-back`，不把恢复后的失败说成未发生写入。
