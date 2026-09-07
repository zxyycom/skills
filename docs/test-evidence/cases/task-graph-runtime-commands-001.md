### Case TASK-GRAPH-RUNTIME-COMMANDS-001: runtime info 保持单 JSON 且不访问索引

Tests:
- `test:533fc33045218d74622667b417d33bbad2f596854aaba4fb672c2e54d8f7b699`

Tags:
- `task-graph`

Contract:
- `runtime info` 无参数、revision 为 null，并与工作区 task index 生命周期隔离；CLI 不提供包管理器执行命令。

Proves:
- missing 与 caller-provisioned compatible 状态都使用一个 LF JSON 与空 stderr，工作区 docs 未创建。
