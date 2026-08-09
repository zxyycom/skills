### Case INDEX-RUNTIME-STAGING-CONCURRENCY-001: 并发选择性暂存不互相覆盖

Entry:
- `tools/index-runtime/tests/staging.test.ts > serializes concurrent selected-entry staging without overwriting a winner`
- `bun test --test-name-pattern="^serializes concurrent selected-entry staging without overwriting a winner$" ./tools/index-runtime/tests/run.ts`

Contract:
- 针对同一索引的并发选择性暂存只能有一个调用从同一 revision 与 pending 期望成功。

Proves:
- 两个并发调用恰有一个成功，另一个返回 `pending-conflict`。
- 最终 pending 完整等于获胜调用的目标，不包含两个调用的隐式合并或覆盖残片。
