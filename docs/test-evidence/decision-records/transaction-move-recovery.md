### Case DECISION-TRANSACTION-MOVE-001: 移动事务在索引替换失败后恢复

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > transaction recovery restores source path target path and index after a post-write failure`
- `bun test --test-name-pattern="^transaction recovery restores source path target path and index after a post-write failure$" ./tools/decision-records/tests/run.ts`

Contract:
- 移动事务在索引替换后的写入失败中必须恢复源路径、目标路径与原索引。

Proves:
- 模拟 index rename 失败后源文件和原 index 恢复，archive 目标不存在。
