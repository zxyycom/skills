### Case TASK-GRAPH-PARENT-COMPLETE-001: 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功

Tests:
- `test:66a0fe7459f1595a81703f9e4cec2bbb8d266f8c6be0252d3c753d67690061d7`

Tags:
- `task-graph`

Contract:
- 父任务完成要求直接子任务全部成功或取消、至少一个成功且没有后代租约。

Proves:
- 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功。
