### Case TASK-GRAPH-LIST-RENDER-FAILURE-001: Task-list failure 使用排序后的文本协议

Entry:
- `tools/task-graph/tests/task-list-renderer.test.ts > task-list renderer serializes failures with sorted JSON details`
- `bun test --test-name-pattern="^task-list renderer serializes failures with sorted JSON details$" ./tools/task-graph/tests/run.ts`

Contract:
- Task-list failure 显示稳定 code、revision、retryable、JSON escaped message 与按 key 排序的 details。

Proves:
- 换行和引号按 JSON string escaping。
- alpha detail 排在 zeta 前，数组和 null 保持 JSON 值格式，结果只以一个 LF 结束。
