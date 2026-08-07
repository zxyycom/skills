### Case TASK-GRAPH-NATIVE-FD-001: 同进程独立描述符遵守原生排他锁

Entry:
- `tools/task-graph/tests/store.test.ts > native binding excludes two independent file descriptors in one process`
- `bun test --test-name-pattern="^native binding excludes two independent file descriptors in one process$" ./tools/task-graph/tests/run.ts`

Contract:
- 稳定普通文件上的 native tryLock 必须对独立描述符互斥，并在 unlock 后立即可再次取得。

Proves:
- 第一个描述符取锁成功时第二个失败；释放后第二个成功。
