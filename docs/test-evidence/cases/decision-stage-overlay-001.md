### Case DECISION-STAGE-OVERLAY-001: Stage 应用选择的新增、修改与删除

Tests:
- `test:aad5eb4f86c172b16aeb02d27f26bc1c5099f871850c4b929c4ced78b653b508`

Tags:
- `decision-records`

Contract:
- stage 将选择的新增、修改、删除和派生索引作为完整 pending 快照暂存；关系 target 与选择均使用纯 ID。

Proves:
- 修改、删除和新增记录后，断言对应路径及 index 暂存。
