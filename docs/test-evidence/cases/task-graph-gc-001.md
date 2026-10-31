### Case TASK-GRAPH-GC-001: 批量 task removal 在全部门禁通过后一次提交

Tests:
- `test:71ae9f808c0bfa23cbfc22deb41588815b64a3763a96b6a35fa5b074a3f8cc5e`

Tags:
- `task-graph`

Contract:
- 显式非空 task 集合共用结果交付确认，先验证全部选择，再以一次 revision 原子删除，并保持 `nextTaskId` 单调。

Proves:
- 空集合、重复 ID 或未确认结果交付时无变更；合法批次排序返回、只增一次 revision 且不复用 ID。
