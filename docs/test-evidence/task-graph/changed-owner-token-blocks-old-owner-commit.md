### Case TASK-GRAPH-LOCK-TOKEN-001: token 被替换后旧 owner 不得提交或删除新 owner 的锁

Entry:
- `tools/task-graph/tests/store.test.ts > a changed lock owner token prevents the old owner from committing`
- `bun test --test-name-pattern="^a changed lock owner token prevents the old owner from committing$" ./tools/task-graph/tests/run.ts`

Contract:
- 提交点和释放前必须确认 lock owner token 仍属于当前写者；验证失败的旧 owner 不得隔离或删除新 owner 的锁。

Proves:
- token 被替换后旧 owner 返回 LOCK_LOST，revision 与 scopes 保持未提交状态，新的 owner token 仍保留在规范 lock directory 中。
