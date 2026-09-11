### Case TASK-GRAPH-STAGE-LIFECYCLE-001: 新增与删除 task 使用同一选择规则

Tests:
- `test:5f151350e4b80b0cb97377156cddac745a1c95c9535408068dfde159a4669249`

Tags:
- `task-graph`

Contract:
- 选中且仅存在于候选的 task 表示新增，选中且仅存在于基线的 task 表示删除；根级 revision 与 nextTaskId 使用候选水位。

Proves:
- 同一批选择能够删除基线 task、加入候选 task，并产出通过解析的完整 pending 索引。
- 目标保留未选择 task，revision 使用候选值且 nextTaskId 保持已分配 ID 之后的单调水位。
