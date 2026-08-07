### Case TASK-GRAPH-RUNTIME-COMMANDS-001: runtime 命令保持单 JSON 且不访问索引

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI runtime info, install reuse, and check use one JSON envelope without index access`
- `bun test --test-name-pattern="^CLI runtime info, install reuse, and check use one JSON envelope without index access$" ./tools/task-graph/tests/run.ts`

Contract:
- `runtime info|install|check` 无参数、revision 为 null，并与工作区 task index 生命周期隔离。

Proves:
- missing info/check、显式 Node 下 install reuse/check 都使用一个 LF JSON 与空 stderr，工作区 docs 未创建。
