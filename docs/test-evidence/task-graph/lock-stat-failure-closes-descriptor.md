### Case TASK-GRAPH-LOCK-HANDLE-001: lock stat 失败仍关闭已打开描述符

Entry:
- `tools/task-graph/tests/store.test.ts > lock FileHandle stat failure still closes the opened descriptor`
- `bun test --test-name-pattern="^lock FileHandle stat failure still closes the opened descriptor$" ./tools/task-graph/tests/run.ts`

Contract:
- 稳定锁文件 open 后的 stat 失败映射为 lock-open `WRITE_FAILED`，且句柄无条件关闭。

Proves:
- 注入 EIO stat 后 close 恰好执行一次，错误 details 标记 `phase: lock-open`。
