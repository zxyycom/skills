### Case DECISION-STAGE-MISSING-DESTINATION-001: 暂存不将缺失新位置冒充同步删除

Tests:
- `test:e6f9643f44a8bbd4331847ba7c1db75977df9a6431cbcb8c4dcb0f8a87d4e546`

Tags:
- `decision-records`

Contract:
- 工作区发布投影仍含选中 ID 时，新位置缺失不得被解释为已同步删除。

Proves:
- 发布移动后移除新位置，domain/all 都失败并保持原 pending tree，不误清旧位置。
