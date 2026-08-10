### Case TEST-EVIDENCE-STAGE-OVERLAY-001: 选择性暂存组合新增删除与显式重命名

Entry:
- `tools/test-evidence/tests/staging.test.ts > stage-index applies selected additions deletions and explicit renames`
- `bun test --test-name-pattern="^stage-index applies selected additions deletions and explicit renames$" ./tools/test-evidence/tests/run.ts`

Contract:
- Case 新增、删除和重命名由选中 ID 在 revision 与工作区索引中的存在状态表达，重命名同时选择旧、新 ID。

Proves:
- 选中的新增 Case 进入 pending，选中的旧 ID 与删除 Case 被移除。
- 未选择 Case 的工作区修改继续使用 revision 基线。
- 文本结果按稳定顺序报告 selected IDs 并提醒领域文件位于操作范围之外。
