### Case TASK-GRAPH-CLI-CLEANUP-001: CLI 暴露批量 task removal 且不存在 scope 命令

Tests:
- `test:7bebdb3e86affc30555abd398f88344c812493207e26c104503aa96111b406af`

Tags:
- `task-graph`

Contract:
- 清理入口是带 revision 与结果交付确认的显式批量 `task remove`；CLI 不提供 scope 层或后台 GC。

Proves:
- 根 help 包含 `task remove` 且没有任何 `scope` command path；调用旧容器命令返回参数错误。
