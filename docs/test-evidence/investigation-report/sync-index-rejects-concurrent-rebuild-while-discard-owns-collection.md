### Case INVESTIGATION-SYNC-DISCARD-LOCK-001: sync-index rejects a concurrent rebuild while discard owns the collection

Entry:
- `tools/investigation-report/tests/discard.test.ts > sync-index rejects a concurrent rebuild while discard owns the collection`
- `bun test --test-name-pattern="^sync-index rejects a concurrent rebuild while discard owns the collection$" ./tools/investigation-report/tests/run.ts`

Contract:
- `sync-index` 与 `discard` 共用调查集合 mutation lock；锁被 `discard` 持有时，同步必须零写入失败，释放后可从最终集合重试。

Proves:
- 在 discard 的 index 提交点暂停时，sync-index 返回包含 busy cause 和 collection no-change outcome 的 `collection-lock-busy` 诊断且 index 保持旧字节；discard 完成后重试成功，最终 index 不再包含已删除的报告 ID。
