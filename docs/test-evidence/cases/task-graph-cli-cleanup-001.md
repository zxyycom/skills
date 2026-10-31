### Case TASK-GRAPH-CLI-CLEANUP-001: CLI help 提供任务移除入口并拒绝 scope 命令

Tests:
- `test:8000be371ad5e7ae96247e074e4590d5ba3bee034b31c577127036d3b26a90e8`

Tags:
- `task-graph`

Contract:
- 清理入口是带 revision 与结果交付确认的显式批量 `task remove`；CLI 不提供 scope 层或后台 GC。

Proves:
- 根 help 可发现 task remove，scope 命令返回 ARGUMENT_INVALID；实际 batch removal 另有原生动作入口承接。
