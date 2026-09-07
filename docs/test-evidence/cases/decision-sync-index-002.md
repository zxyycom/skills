### Case DECISION-SYNC-INDEX-002: 同步索引在决策事务持锁时快速失败

Tests:
- `test:370baecbcb599351c4b3ffe606a22ebade1e789c2e89ab698d6bfff08bbbf131`

Tags:
- `decision-records`

Contract:
- 生命周期、关系与 discard 共用的 Decision Markdown 与索引事务，与 `sync-index` 共享同一个集合级 mutation lock。
- 锁被事务持有时，`sync-index` 快速失败而不写入旧投影，并给出可在事务结束后重试的失败反馈。

Proves:
- 事务持锁期间 `sync-index` 以非零状态快速失败、说明锁冲突和重试动作，且索引字节不变。
- 事务完成后重试同步成功；持久索引投影与已更新的 Markdown 和严格验证一致。
