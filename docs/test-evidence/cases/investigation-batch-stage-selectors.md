### Case INVESTIGATION-BATCH-STAGE-SELECTORS-001: 整批暂存选择保留身份解析义务

Tests:
- `test:3b49d8a5980b937afa3494f11b8b6c84a677e54c8dee41f11169f9e64d0242e3`
- `test:ed4363f1189697de9b32860a16ebd30f9e0e5e74c67fade43827ac63f15d33b7`

Tags:
- `investigation-report`

Contract:
- 暂存选择从baseline与workspace最终ID/name集合解析；标准ID优先，重复选择仍交原下游约束。

Proves:
- 同ID的workspace name覆盖基线，基线-only与新增项均可选；dated未知ID不误作name解析，重复alias保留重复ID。
- 缺失与歧义诊断按selector输入顺序保留，完整候选ID按UTF-16顺序输出。
