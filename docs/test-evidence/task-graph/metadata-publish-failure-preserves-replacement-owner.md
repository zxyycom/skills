### Case TASK-GRAPH-LOCK-PUBLISH-001: metadata 发布失败不得清理竞争者的新 canonical owner

Entry:
- `tools/task-graph/tests/store.test.ts > metadata publish failure never discards a replacement canonical owner`
- `bun test --test-name-pattern="^metadata publish failure never discards a replacement canonical owner$" ./tools/task-graph/tests/run.ts`

Contract:
- fresh lock metadata 发布失败时只能清理仍由本次 staged 或 published owner token 标识的 generation；canonical owner 已换代时必须返回恢复错误并保留新锁。

Proves:
- metadata 已暂存但最终发布前 canonical lock 被替换时，操作返回 `LOCK_RECOVERY_REQUIRED`，新 owner token 保持不变，索引 revision 与 scopes 未提交。
