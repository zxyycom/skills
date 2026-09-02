### Case DECISION-SYNC-INDEX-CLEANUP-001: 当前派生索引的锁清理失败报告 no-change

Entry:
- `tools/decision-records/tests/transaction-recovery.test.ts > sync-index retains no-change when a current index lock release fails`
- `bun test --test-name-pattern="^sync-index retains no-change when a current index lock release fails$" ./tools/decision-records/tests/run.ts`

Contract:
- `sync-index` 发现派生 index 已 current 后若 collection lock 无法释放，只能报告 `no-change`；成功回调不能单独作为已写入事实。

Proves:
- CLI 退出 1、stdout 保持为空并输出 collection-lock-release-failed。
- stderr 包含 `no-change`，不包含 `committed-cleanup-pending`。
