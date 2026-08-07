### Case TASK-GRAPH-GITIGNORE-FAIL-001: 局部 ignore 写失败不创建索引或锁

Entry:
- `tools/task-graph/tests/store.test.ts > local ignore write failure creates no index, lock, or atomic runtime artifact`
- `bun test --test-name-pattern="^local ignore write failure creates no index, lock, or atomic runtime artifact$" ./tools/task-graph/tests/run.ts`

Contract:
- ignore 写入或回读失败必须发生在锁与索引创建前，并返回稳定 write phase。

Proves:
- 注入 ignore atomic 失败后 index、lock、ignore 与临时 artifact 均不存在。
