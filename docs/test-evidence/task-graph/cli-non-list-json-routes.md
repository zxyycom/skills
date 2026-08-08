### Case TASK-GRAPH-CLI-JSON-ROUTES-001: Task-list help 与非 list command 保持 JSON route

Entry:
- `tools/task-graph/tests/cli.test.ts > CLI task-list help and non-list commands remain on the JSON protocol`
- `bun test --test-name-pattern="^CLI task-list help and non-list commands remain on the JSON protocol$" ./tools/task-graph/tests/run.ts`

Contract:
- 只有默认实际 task list command 使用文本 renderer；task-list help 与其他 command 的 success/failure 保持 JSON。

Proves:
- Task-list help、task show success 与缺参 task show failure 都可按单 JSON envelope 解析。
