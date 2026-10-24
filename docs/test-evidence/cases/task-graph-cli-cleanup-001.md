### Case TASK-GRAPH-CLI-CLEANUP-001: CLI help 发现移除任务并拒绝旧 scope 命令

Tests:
- `test:5e7c0ed60613ba35c65748a1e5b2a9c4afafd244f31c4c701978541b4f4e8ec3`

Tags:
- `task-graph`

Contract:
- 清理入口是带 revision 与结果交付确认的显式批量 `task remove`；CLI 不提供 scope 层或后台 GC。

Proves:
- 根 help 可发现 task remove，旧 scope 命令被 usage 拒绝；实际 batch removal 另有原生动作入口承接。
