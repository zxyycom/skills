### Case TASK-GRAPH-PARENT-COMPLETE-001: 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功

Entry:
- `tools/task-graph/tests/lifecycle.test.ts > parent completion requires settled children, one success, and no descendant lease`
- `bun test --test-name-pattern="^parent completion requires settled children, one success, and no descendant lease$" ./tools/task-graph/tests/run.ts`

Contract:
- 父任务完成要求直接子任务全部成功或取消、至少一个成功且没有后代租约。

Proves:
- 未收敛或全取消子任务阻止完成，混合成功/取消允许 attempt 0 的父任务成功。
