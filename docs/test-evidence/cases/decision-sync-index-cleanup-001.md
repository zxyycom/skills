### Case DECISION-SYNC-INDEX-CLEANUP-001: 当前派生索引的锁清理失败报告 no-change

Tests:
- `test:564546b7cec38cbaa422f549acb004158fd1a2c41555070540778da496ef6f8b`

Tags:
- `decision-records`

Contract:
- `sync-index` 发现派生 index 已 current 后若 collection lock 无法释放，只能报告 `no-change`；成功回调不能单独作为已写入事实。

Proves:
- CLI 退出 1、stdout 保持为空并输出 collection-lock-release-failed。
- stderr 包含 `no-change`，不包含 `committed-cleanup-pending`。
