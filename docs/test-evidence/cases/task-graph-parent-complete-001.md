### Case TASK-GRAPH-PARENT-COMPLETE-001: 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功

Tests:
- `test:0de92d90e790722a47061b70b7e3766689c519c50eb7c5d8d0b8b270dbb3824c`

Tags:
- `task-graph`

Contract:
- 父任务完成要求直接子任务全部成功或取消、至少一个成功且没有后代租约。

Proves:
- 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功。
