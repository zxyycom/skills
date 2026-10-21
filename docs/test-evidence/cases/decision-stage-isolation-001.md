### Case DECISION-STAGE-ISOLATION-001: Stage 隔离未选择的文件系统变更

Tests:
- `test:2d8b82b436ab90d41f1ca4f64885566bad3bbf7de619177048f15239d9f87c51`

Tags:
- `decision-records`

Contract:
- 领域 target 与派生索引只采用已选 ID 的当前来源；未选新增不进入结果，未选已有成员保持基线来源。

Proves:
- 所选新增进入 target 与投影，未选新增被排除；未选已有成员虽有工作区修改，target 保留基线完整字节，索引保留基线标题。
