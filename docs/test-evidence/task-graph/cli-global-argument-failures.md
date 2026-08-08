### Case TASK-GRAPH-CLI-GLOBAL-FAILURE-001: 全局参数解析 failure 使用 revision-null JSON

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI global argument failures use revision-null JSON`
- `bun test --test-name-pattern="^CLI global argument failures use revision-null JSON$" ./tools/task-graph/tests/run.ts`

Contract:
- Invocation route 建立前的全局参数错误统一使用 JSON serializer，revision 为 null。

Proves:
- 重复 --json、带值 --json、以及 --root 或 --index 分离值被后续 --json 占位都返回对应 ARGUMENT_INVALID message。
- 所有结果是单 LF JSON，不能误进入 task-list failure renderer。
