### Case TASK-GRAPH-STAGE-SELECTION-001: 选中 task 使用候选条目与全局水位

Tests:
- `test:92d256c88680a7a6122278f7de2273929b35a83b7d8d313ef8ea61c0a61cc0c6`

Tags:
- `task-graph`

Contract:
- Task index 分段暂存以 HEAD 为基线、目标工作区为候选，只替换选中 task 条目；revision 与 nextTaskId 使用不可分割的候选全局水位。

Proves:
- Pending 中选中 task 使用候选内容，未选中既有 task 保持基线，未选中的新增 task 不进入目标。
- Pending 的 revision 与 nextTaskId 等于候选值，工作区索引和索引外既有 pending 文件逐字保持不变。
