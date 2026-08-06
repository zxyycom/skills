### Case TASK-GRAPH-LOCK-CLAIMED-001: claimed generation 只在本机 claimant 已确认失效时精确接管

Entry:
- `tools/task-graph/tests/store.test.ts > claimed recovery generations wait, reject uncertainty, and allow dead takeover`
- `bun test --test-name-pattern="^claimed recovery generations wait, reject uncertainty, and allow dead takeover$" ./tools/task-graph/tests/run.ts`

Contract:
- fresh claimed generation 必须等待；stale claimed generation 只有在 owner/reclaimer metadata 与文件名相符、host 相同且 claimant pid 已确认失效时，才能通过精确 generation rename 接管。remote、alive、unknown、非法 JSON、符号链接和 token 碰撞均停止自动恢复，竞争者只能清理自己成功创建的 reclaimer 文件。

Proves:
- fresh claimant 超时后仍保留；不可确认或非法 generation 返回 `LOCK_RECOVERY_REQUIRED`；既存 reclaimer token 的内容不被碰撞者删除；本机 dead claimant 可由新 generation 接管并只提交一次 mutation，注入的恢复 errno 也被映射为稳定错误。
