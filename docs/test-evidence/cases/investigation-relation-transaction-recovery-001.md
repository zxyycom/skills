### Case INVESTIGATION-RELATION-TRANSACTION-RECOVERY-001: set-relations 发布失败恢复字节且不返回成功核对

Tests:
- `test:55ca6b496b5adedb70690820901bcaac6c6ddaa8f968dfed2379a407120bb99e`
- `test:77d271fb36e327f10edf15977c20fed2641a4fe136d9c611d07ce735e625def1`

Tags:
- `investigation-report`

Contract:
- 关系事务发布失败时恢复已写报告和索引的旧字节；回滚或提交后锁清理未完成的失败结果不得携带成功 relationReview。

Proves:
- 模拟第二次写入失败后报告内容与发布前相同，返回 `rolled-back` outcome 和发布诊断 code，且 `relationReview` 为 undefined。
- 锁释放清理失败后保留已提交的报告和索引字节，返回 `committed-cleanup-pending`，且 `relationReview` 为 undefined。
