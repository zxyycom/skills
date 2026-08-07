### Case TASK-GRAPH-NATIVE-EXIT-001: 持锁子进程退出后 OS 自动释放 native lock

Entry:
- `tools/task-graph/tests/native-store.test.ts > operating system releases a child process native lock without stale metadata recovery`
- `node --test --test-name-pattern="^operating system releases a child process native lock without stale metadata recovery$" ./tools/task-graph/tests/native-store.test.ts`

Contract:
- 进程崩溃释放由 OS 文件锁语义承接，不使用 owner metadata 或 stale recovery。

Proves:
- 显式 Node holder 被终止后下一 mutation 成功，稳定锁文件内容仍为空且未删除。
