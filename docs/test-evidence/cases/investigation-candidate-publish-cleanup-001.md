### Case INVESTIGATION-CANDIDATE-PUBLISH-CLEANUP-001: publish 提交后锁清理失败不返回成功核对

Tests:
- `test:5612e9c1ecb0a757ecde7624a3d8da3c245a650f866deea9658d7e2c4be26096`

Tags:
- `investigation-report`

Contract:
- candidate publish 已提交后若集合锁清理失败，正式报告保持已提交状态，结果标记 `committed-cleanup-pending`，且不得携带成功 relationReview。

Proves:
- 注入锁释放清理失败后正式报告仍存在，返回包含失败信息的 committed-cleanup-pending mutation，且 `relationReview` 为 undefined。
