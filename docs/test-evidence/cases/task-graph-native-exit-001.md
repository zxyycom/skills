### Case TASK-GRAPH-NATIVE-EXIT-001: 持锁子进程退出后 OS 自动释放 native lock

Tests:
- `test:d3268d2f9f1e11d9a23bb33102aadf0172df15c740eef044d081dcc21e61fe1f`

Tags:
- `task-graph`

Contract:
- 进程崩溃释放由 OS 文件锁语义承接，不使用 owner metadata 或 stale recovery。

Proves:
- 显式 Node holder 被终止后下一 mutation 成功，稳定锁文件内容仍为空且未删除。
