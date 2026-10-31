### Case TASK-GRAPH-RUNTIME-COMMANDS-001: runtime info 保持单 JSON 且不访问索引

Tests:
- `test:2debc2e113fe4accbb149222aaec3e916644156fb58e4d995ff8b42fba3e3d3c`

Tags:
- `task-graph`

Contract:
- `runtime info` 无参数、revision 为 null，并与工作区 task index 生命周期隔离；CLI 不提供包管理器执行命令。

Proves:
- missing 与 caller-provisioned compatible 状态都使用一个 LF JSON 与空 stderr，工作区 docs 未创建。
