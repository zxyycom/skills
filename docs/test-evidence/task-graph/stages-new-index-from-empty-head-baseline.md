### Case TASK-GRAPH-STAGE-EMPTY-HEAD-001: HEAD 无索引时从空基线暂存新索引

Entry:
- `tools/task-graph/tests/staging.test.ts > stages a new task index from an empty HEAD baseline`
- `bun test --test-name-pattern="^stages a new task index from an empty HEAD baseline$" ./tools/task-graph/tests/run.ts`

Contract:
- Git HEAD 尚无 task index 时，分段暂存使用当前 Schema 的空索引作为基线，并把选中的工作区 task 合成为新的 pending 文件。

Proves:
- 真实 Git 仓库只有索引外基线文件时，选中首个候选 task 后 pending 新增完整 task index，且没有带入索引外路径。
