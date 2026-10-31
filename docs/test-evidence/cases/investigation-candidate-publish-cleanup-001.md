### Case INVESTIGATION-CANDIDATE-PUBLISH-CLEANUP-001: publish 提交后锁清理失败不返回成功核对

Tests:
- `test:6daa6d870fe6a94ec972c04d6b1ec181e90ba355230e303c52068d1e0ca326f4`

Tags:
- `investigation-report`

Contract:
- candidate publish 已提交后若集合锁清理失败，正式报告保持已提交状态，结果标记 `committed-cleanup-pending`，且不得携带成功 relationReview。

Proves:
- 注入锁释放清理失败后正式报告仍存在，返回包含失败信息的 committed-cleanup-pending mutation，且 `relationReview` 为 undefined。
