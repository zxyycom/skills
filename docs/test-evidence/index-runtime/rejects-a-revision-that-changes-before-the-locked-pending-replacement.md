### Case INDEX-RUNTIME-STAGING-REVISION-CONFLICT-001: 锁内拒绝已变化的 Current Revision

Entry:
- `tools/index-runtime/tests/staging.test.ts > rejects a revision that changes before the locked pending replacement`
- `bun test --test-name-pattern="^rejects a revision that changes before the locked pending replacement$" ./tools/index-runtime/tests/run.ts`

Contract:
- 选择目标使用的 current revision 必须在 pending 写入锁内仍是当前 revision。

Proves:
- 目标完成投影后 revision 发生变化会返回 `pending-conflict`、受控 pending scope 的 `no-change` 和 `unknown` 原因。
- pending 仍干净时，冲突诊断不会要求清除或提交，而是要求重新读取 revision 与目标 pending 后从最新状态重试。
- 冲突不会写入 pending，也不会修改工作区索引。
