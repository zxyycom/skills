### Case TASK-GRAPH-RETRY-001: 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > failure retry preserves attempts and terminal tasks cannot reopen`
- `bun test --test-name-pattern="^failure retry preserves attempts and terminal tasks cannot reopen$" ./tools/task-graph/tests/run.ts`

Contract:
- retry 仅将 failed 恢复 idle 并保留累计 attempt，成功与取消终态不可 reopen。

Proves:
- 重试后的下一次 claim 增加 attempt，成功任务拒绝内容、control 与 retry 改写。
