### Case TASK-GRAPH-ID-001: 扩展 task ID 保持规范，失败批次不消耗编号

Tests:
- `test:1595d5871d9065eb28be35f2db68db58671e1db74055c532f18227a44f376f88`

Tags:
- `task-graph`

Contract:
- Task ID 单调分配并可扩展到六位以上，`nextTaskId` 必须严格大于全部已分配 task ID。

Proves:
- 七位 task ID 保持规范；失败 apply 不改变原索引或消耗编号，回退计数器的索引被拒绝。
