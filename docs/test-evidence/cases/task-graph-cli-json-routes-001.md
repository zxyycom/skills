### Case TASK-GRAPH-CLI-JSON-ROUTES-001: Help 与无专用文本 renderer 的 command 保持 JSON route

Tests:
- `test:4747016189a6d242f7e1e37a6b9047d970f2f3f805f4cca00d0ecbb7b7cc424b`

Tags:
- `task-graph`

Contract:
- 默认实际 task list 与 index stage 使用各自文本 renderer；help 和没有专用文本 renderer 的 command 保持 JSON。

Proves:
- Task-list help、task show success 与缺参 task show failure 都可按单 JSON envelope 解析。
