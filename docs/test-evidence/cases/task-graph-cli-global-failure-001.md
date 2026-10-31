### Case TASK-GRAPH-CLI-GLOBAL-FAILURE-001: 全局参数解析 failure 使用 revision-null JSON

Tests:
- `test:ec349930835a9459c7da46a15d6fad88719e5ec5e9854575cdbb9220f5bd26fd`

Tags:
- `task-graph`

Contract:
- Invocation route 建立前的全局参数错误统一使用 JSON serializer，revision 为 null。

Proves:
- 重复 --json、带值 --json、以及 --root 或 --index 分离值被后续 --json 占位都返回对应 ARGUMENT_INVALID message。
- 所有结果是单 LF JSON，不能误进入 task-list failure renderer。
