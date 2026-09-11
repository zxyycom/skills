### Case DECISION-STAGE-OVERLAY-001: Stage 应用选择的新增、修改与删除

Tests:
- `test:f55a11548dce7c1d02b56114f5abf8ff162f524938ba6a323b622ea4452fa042`

Tags:
- `decision-records`

Contract:
- stage 将选择的新增、修改、删除和派生索引作为完整 pending 快照暂存；关系 target 与选择均使用纯 ID。

Proves:
- 修改、删除和新增记录后，断言对应路径及 index 暂存。
