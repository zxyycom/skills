### Case INVESTIGATION-RELATION-TRANSACTION-RECOVERY-001: set-relations restores all report and index bytes after publish failure

Tests:
- `test:55ca6b496b5adedb70690820901bcaac6c6ddaa8f968dfed2379a407120bb99e`

Tags:
- `investigation-report`

Contract:
- 关系事务发布失败时恢复已写报告和索引的旧字节。

Proves:
- 模拟第二次写入失败后报告内容与发布前相同，并返回 `rolled-back` outcome 和发布诊断 code。
