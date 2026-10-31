### Case TASK-GRAPH-STAGE-LIFECYCLE-001: 新增与删除 task 使用同一选择规则

Tests:
- `test:8fd2e61c8972ad1bb1af5d721bfd1c86a80f499b8df3d1c65bf7da4088a34190`

Tags:
- `task-graph`

Contract:
- 选中且仅存在于候选的 task 表示新增，选中且仅存在于基线的 task 表示删除；根级 revision 与 nextTaskId 使用候选水位。

Proves:
- 同一批选择能够删除基线 task、加入候选 task，并产出通过解析的完整 pending 索引。
- 目标保留未选择 task，revision 使用候选值且 nextTaskId 保持已分配 ID 之后的单调水位。
