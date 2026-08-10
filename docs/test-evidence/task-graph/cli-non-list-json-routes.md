### Case TASK-GRAPH-CLI-JSON-ROUTES-001: Help 与无专用文本 renderer 的 command 保持 JSON route

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI task-list help and commands without text renderers remain on the JSON protocol`
- `bun test --test-name-pattern="^CLI task-list help and commands without text renderers remain on the JSON protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- 默认实际 task list 与 index stage 使用各自文本 renderer；help 和没有专用文本 renderer 的 command 保持 JSON。

Proves:
- Task-list help、task show success 与缺参 task show failure 都可按单 JSON envelope 解析。
