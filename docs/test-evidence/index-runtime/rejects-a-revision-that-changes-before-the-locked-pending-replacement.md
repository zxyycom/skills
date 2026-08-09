### Case INDEX-RUNTIME-STAGING-REVISION-CONFLICT-001: 锁内拒绝已变化的 Current Revision

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects a revision that changes before the locked pending replacement`
- `bun test --test-name-pattern="^rejects a revision that changes before the locked pending replacement$" ./tools/index-runtime/tests/run.ts`

Contract:
- 选择目标使用的 current revision 必须在 pending 写入锁内仍是当前 revision。

Proves:
- 目标完成投影后 revision 发生变化会返回 `pending-conflict`。
- 冲突不会写入 pending，也不会修改工作区索引。
