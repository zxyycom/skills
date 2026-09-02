### Case INVESTIGATION-SYNC-DIAGNOSTIC-001: sync-index preserves post-rename uncertainty when lock cleanup also fails

Entry:
- `tools/investigation-report/tests/transaction.test.ts > sync-index preserves post-rename uncertainty when lock cleanup also fails`
- `bun test --test-name-pattern="^sync-index preserves post-rename uncertainty when lock cleanup also fails$" ./tools/investigation-report/tests/run.ts`

Contract:
- `sync-index` 的 atomic rename 后 verify 失败已不能证明未发布；后续 collection lock cleanup 再失败时，包装结果必须优先保留原有 partial-or-unknown mutation，不能用 `changed: false` 覆盖为 no-change。

Proves:
- 注入 target rename 后、verify read 前的并发覆盖及 lock release 失败后，运行时保留 index-write-failed，最终 index 仍为并发写入内容，结果与 release diagnostic 均以集合 scope 和 partial-or-unknown outcome 表达。
