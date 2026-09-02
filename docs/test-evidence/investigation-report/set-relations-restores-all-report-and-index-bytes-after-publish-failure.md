### Case INVESTIGATION-RELATION-TRANSACTION-RECOVERY-001: set-relations restores all report and index bytes after publish failure

Entry:
- `tools/investigation-report/tests/transaction.test.ts > set-relations restores all report and index bytes after publish failure`
- `bun test --test-name-pattern="^set-relations restores all report and index bytes after publish failure$" ./tools/investigation-report/tests/run.ts`

Contract:
- 关系事务发布失败时恢复已写报告和索引的旧字节。

Proves:
- 模拟第二次写入失败后报告内容与发布前相同，并返回 `rolled-back` outcome 和发布诊断 code。
