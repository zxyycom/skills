### Case DECISION-TRANSACTION-MOVE-001: 移动事务在索引发布前失败后恢复

Tests:
- `test:7f3364b8eb3fbbf6f87f66f248cb6ffd9f75cf4208e09a7b20fab1a1244c46bc`

Tags:
- `decision-records`

Contract:
- 移动事务在索引发布前失败时，只恢复仍归本事务所有的实际写集，并证明旧源路径、目标路径与原索引。

Proves:
- 在原子 index rename 执行前注入 `EIO`，事务报告受控失败详情，并恢复源文件和原 index，archive 目标不存在。
- 事务结果声明 `rolled-back`，不把恢复后的失败说成未发生写入。
