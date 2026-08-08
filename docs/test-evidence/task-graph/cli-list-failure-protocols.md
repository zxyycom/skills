### Case TASK-GRAPH-CLI-LIST-FAILURE-001: Task-list command failure 遵循选定输出协议

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI task-list command failures follow the selected output protocol`
- `bun test --test-name-pattern="^CLI task-list command failures follow the selected output protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-list route 建立后的 command-local failure 默认使用 task-list failure renderer；合法 `--json` 把同类 failure 切换到 JSON serializer。

Proves:
- 同一多余 positional failure 在两种模式下都退出 1、返回 ARGUMENT_INVALID 与当前 revision 0。
- 默认文本包含 TASK LIST ERROR 和 actualPositionals detail；JSON 模式产生合法 failure envelope。
