### Case INDEX-RUNTIME-STAGING-PENDING-RECOVERY-001: 以明确部分结果报告 Pending 恢复不完整

Tests:
- `test:f946066f70dad5caf3697273d03224ec18a961b6ebc88b91ad1aa6f097654344`

Tags:
- `index-runtime`

Contract:
- staging 是 pending mutation 的事务 owner；恢复不完整时必须保留确切 scope 与 `partial-or-unknown` outcome，而不能声称范围已恢复。

Proves:
- 注入 `pending-recovery-failed` 后结果的 state 为 `pending-recovery-failed`、changed 为 `null`，并报告目标索引 pending scope 的 `partial-or-unknown`。
- 诊断保留共享 recovery operation、access-denied 原因和受控 target。
