### Case TASK-GRAPH-CLI-JSON-ROUTES-001: Help 与无专用文本 renderer 的 command 保持 JSON route

Tests:
- `test:00bed3be9cc78d0770b94c63c9296531ca8c688f52aedef654b8600f9b1214ca`

Tags:
- `task-graph`

Contract:
- 默认实际 task list 与 index stage 使用各自文本 renderer；help 和没有专用文本 renderer 的 command 保持 JSON。

Proves:
- Task-list help、task show success 与缺参 task show failure 都可按单 JSON envelope 解析。
