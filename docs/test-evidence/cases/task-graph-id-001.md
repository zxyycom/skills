### Case TASK-GRAPH-ID-001: 扩展 task ID 保持规范，失败批次不消耗编号

Tests:
- `test:65f2aedd1501e2682f30bae96c18a69d4b4909bc486881f0f342f0560f2cd0c9`

Tags:
- `task-graph`

Contract:
- Task ID 单调分配并可扩展到六位以上，`nextTaskId` 必须严格大于全部已分配 task ID。

Proves:
- 七位 task ID 保持规范；失败 apply 不改变原索引或消耗编号，回退计数器的索引被拒绝。
