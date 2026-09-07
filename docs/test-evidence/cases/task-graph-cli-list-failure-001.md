### Case TASK-GRAPH-CLI-LIST-FAILURE-001: Task-list command failure 遵循选定输出协议

Tests:
- `test:57fb957cbf183b7a27d5a3c33494e48592562f67cc24209f61b89099cfc51107`

Tags:
- `task-graph`

Contract:
- Task-list route 建立后的 command-local failure 默认使用 task-list failure renderer；合法 `--json` 把同类 failure 切换到 JSON serializer。

Proves:
- 同一多余 positional failure 在两种模式下都退出 1、返回 ARGUMENT_INVALID 与当前 revision 0。
- 默认文本包含 TASK LIST ERROR 和 actualPositionals detail；JSON 模式产生合法 failure envelope。
