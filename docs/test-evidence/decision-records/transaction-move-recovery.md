### Case DECISION-TRANSACTION-MOVE-001: 移动事务在索引替换失败后恢复

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > transaction recovery restores source path target path and index after a post-write failure`
- `bun test --test-name-pattern="^transaction recovery restores source path target path and index after a post-write failure$" ./tools/decision-records/tests/run.ts`

Contract:
- 移动事务在索引替换后的写入失败中必须恢复源路径、目标路径与原索引。

Proves:
- 在原子 index rename 已完成后注入 `EIO`，事务报告受控失败详情，并恢复源文件和原 index，archive 目标不存在。
- 事务结果声明 `rolled-back`，不把恢复后的失败说成未发生写入。
