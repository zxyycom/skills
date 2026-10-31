### Case DECISION-STAGE-MISSING-DESTINATION-001: 暂存不将缺失新位置冒充同步删除

Tests:
- `test:132513b93009882ee8ec58b87bace3f8990df606386df1954b3bfcc127c4b27b`

Tags:
- `decision-records`

Contract:
- 工作区发布投影仍含选中 ID 时，新位置缺失不得被解释为已同步删除。

Proves:
- 发布移动后移除新位置，domain/all 都失败并保持原 pending tree，不误清旧位置。
