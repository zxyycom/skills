### Case DECISION-SYNC-INDEX-CLEANUP-001: 当前派生索引的锁清理失败报告 no-change

Tests:
- `test:84ea2f211590b798d5601c73bc533c0d01c8d87a079bd379fe1b15db7a6aa96f`

Tags:
- `decision-records`

Contract:
- `sync-index` 发现派生 index 已 current 后若 collection lock 无法释放，只能报告 `no-change`；成功回调不能单独作为已写入事实。

Proves:
- CLI 退出 1、stdout 保持为空并输出 collection-lock-release-failed。
- stderr 包含 `no-change`，不包含 `committed-cleanup-pending`。
