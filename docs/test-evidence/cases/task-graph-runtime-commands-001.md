### Case TASK-GRAPH-RUNTIME-COMMANDS-001: runtime info 保持单 JSON 且不访问索引

Tests:
- `test:3511bc1a3e83a1b8547373139e8590405e7de45e51df08cec5941949a870533d`

Tags:
- `task-graph`

Contract:
- `runtime info` 无参数、revision 为 null，并与工作区 task index 生命周期隔离；CLI 不提供包管理器执行命令。

Proves:
- missing 与 caller-provisioned compatible 状态都使用一个 LF JSON 与空 stderr，工作区 docs 未创建。
