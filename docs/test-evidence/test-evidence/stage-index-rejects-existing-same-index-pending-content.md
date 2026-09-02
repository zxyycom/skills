### Case TEST-EVIDENCE-STAGE-CONFLICT-001: 同索引既有 Pending 被拒绝并原样保留

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index rejects existing same-index pending content`
- `bun test --test-name-pattern="^stage-index rejects existing same-index pending content$" ./tools/test-evidence/tests/run.ts`

Contract:
- 目标测试证据索引已有待提交内容时，选择性暂存不得覆盖、累加、清除或绕过该内容。

Proves:
- 命令返回 `pending-conflict` 并逐字保留既有 pending 索引。
- 结果把目标索引范围与 `no-change` outcome 作为 pending mutation 事实保留。
- 目标外 pending 路径和工作区索引保持不变。
