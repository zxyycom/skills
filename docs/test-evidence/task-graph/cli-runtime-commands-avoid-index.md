### Case TASK-GRAPH-RUNTIME-COMMANDS-001: runtime info 保持单 JSON 且不访问索引

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI runtime info reports missing and compatible states without index access`
- `bun test --test-name-pattern="^CLI runtime info reports missing and compatible states without index access$" ./tools/task-graph/tests/run.ts`

Contract:
- `runtime info` 无参数、revision 为 null，并与工作区 task index 生命周期隔离；CLI 不提供包管理器执行命令。

Proves:
- missing 与 caller-provisioned compatible 状态都使用一个 LF JSON 与空 stderr，工作区 docs 未创建。
