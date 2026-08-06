### Case TASK-GRAPH-LEASE-001: 非法时长和错误 lease 拒绝，过期需匹配 recover，活动租约需 force 与 expectedRevision

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > lease lifecycle enforces duration, renewal, expiry, matching recovery, and force`
- `bun test --test-name-pattern="^lease lifecycle enforces duration, renewal, expiry, matching recovery, and force$" ./tools/task-graph/tests/run.ts`

Contract:
- 租约 ID 在全索引 running task 中唯一；complete/cancel 必须且只能给出 lease 或 revision 之一；租约时长、续期、匹配、过期恢复和活动租约强制恢复遵守固定状态机。

Proves:
- 重复 lease 生成以可重试 `LEASE_CONFLICT` 拒绝且索引/revision 不变；complete/cancel 两种前置条件同给或都不给以参数错误拒绝；非法时长和错误 lease 拒绝，过期需匹配 recover，活动租约需 force 与 expectedRevision。
