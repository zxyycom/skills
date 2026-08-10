### Case INVESTIGATION-STAGE-CONFLICT-001: 同索引既有 pending 被拒绝并原样保留
Entry:
- `tools/investigation-report/tests/staging.test.ts > stage-index rejects existing same-index pending and preserves outside pending files`
- `bun test --test-name-pattern="^stage-index rejects existing same-index pending and preserves outside pending files$" ./tools/investigation-report/tests/run.ts`
Contract:
- 目标调查索引已有待提交内容时，`stage-index` 必须拒绝覆盖、累加或清除；目标外的 pending 路径也不能受影响。
Proves:
- 既有索引 pending 与更新的工作区索引形成冲突时返回 `pending-conflict`，索引 pending、外部 pending 路径和工作区索引全部保持原样。
