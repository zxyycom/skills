### Case TASK-GRAPH-LOCK-RELEASE-002: 已提交 mutation 的 release 失败返回未知结果

Entry:
- `tools/task-graph/tests/store.test.ts > committed mutations report unknown outcome when lock release isolation fails`
- `bun test --test-name-pattern="^committed mutations report unknown outcome when lock release isolation fails$" ./tools/task-graph/tests/run.ts`

Contract:
- mutation 已完成原子替换与读回后，lock release/isolation 失败不能把已提交结果报告为未提交。

Proves:
- 调用返回 WRITE_OUTCOME_UNKNOWN，索引 revision 已增加且已提交 scope 可读。
