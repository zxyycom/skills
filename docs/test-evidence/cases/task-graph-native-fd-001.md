### Case TASK-GRAPH-NATIVE-FD-001: 同进程独立描述符遵守原生排他锁

Tests:
- `test:f4f482012627e185b555455097683809d4601d6e0e97e1c565f3e3cc3af83622`

Tags:
- `task-graph`

Contract:
- 稳定普通文件上的 native tryLock 必须对独立描述符互斥，并在 unlock 后立即可再次取得。

Proves:
- 第一个描述符取锁成功时第二个失败；释放后第二个成功。
