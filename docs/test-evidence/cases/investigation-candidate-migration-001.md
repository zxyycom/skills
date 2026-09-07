### Case INVESTIGATION-CANDIDATE-MIGRATION-001: new 在 legacy 同名冲突前要求显式迁移

Tests:
- `test:468b33bfef0982f3df5b55e37dc51cf2814df1996f4ad436880fd50d4cd2bb68`

Tags:
- `investigation-report`

Contract:
- 新 Investigation 将造成无日期 legacy ID 同名冲突时，`new` 返回 `migration-required` 且不写入；显式迁移 legacy ID 后才允许重试。

Proves:
- 阻断结果保留稳定 migration-required 诊断并没有 candidate 文件。
- 将 legacy frontmatter ID 显式改为日期 ID 并同步索引后，同一 name 重试会创建完整日期 ID candidate，且在 name 路径被占用时回退到 ID locator。
