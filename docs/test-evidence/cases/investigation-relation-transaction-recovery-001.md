### Case INVESTIGATION-RELATION-TRANSACTION-RECOVERY-001: set-relations 发布失败恢复字节且不返回成功核对

Tests:
- `test:7d7496410b47daa2ec1f441a097c0b4e44e91bed2ca3906c37903b4b30516e42`
- `test:f65bd97b9024c17e6d25849a89970188d05fa9a2cc0f096236ce779602cd345b`

Tags:
- `investigation-report`

Contract:
- 关系事务发布失败时恢复已写报告和索引的旧字节；回滚或提交后锁清理未完成的失败结果不得携带成功 relationReview。

Proves:
- 模拟第二次写入失败后报告内容与发布前相同，返回 `rolled-back` outcome 和发布诊断 code，且 `relationReview` 为 undefined。
- 锁释放清理失败后保留已提交的报告和索引字节，返回 `committed-cleanup-pending`，且 `relationReview` 为 undefined。
