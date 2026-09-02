### Case INVESTIGATION-COLLECTION-LOCK-DIAGNOSTICS-001: collection mutation lock distinguishes busy access and release failures

Entry:
- `tools/investigation-report/tests/transaction.test.ts > collection mutation lock distinguishes busy access and release failures`
- `bun test --test-name-pattern="^collection mutation lock distinguishes busy access and release failures$" ./tools/investigation-report/tests/run.ts`

Contract:
- 调查集合 lock 只有 exclusive create 明确返回 `EEXIST` 时才是 busy；访问和未知 I/O 保持各自诊断，释放失败不得被吞掉。

Proves:
- 注入的 `EEXIST`、`EACCES` 和 `EIO` 分别返回 busy、access-denied 和 unavailable code；busy 情况同时标注 busy cause category。
- 事务完成后的删除 lock 失败返回 release-failed 诊断。
