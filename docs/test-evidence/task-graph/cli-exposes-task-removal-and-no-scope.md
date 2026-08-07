### Case TASK-GRAPH-CLI-CLEANUP-001: CLI 暴露批量 task removal 且不存在 scope 命令

Entry:
- `tools/task-graph/tests/task-removal.test.ts > CLI exposes batch task removal and no scope command`
- `bun test --test-name-pattern="^CLI exposes batch task removal and no scope command$" ./tools/task-graph/tests/run.ts`

Contract:
- 清理入口是带 revision 与结果交付确认的显式批量 `task remove`；CLI 不提供 scope 层或后台 GC。

Proves:
- 根 help 包含 `task remove` 且没有任何 `scope` command path；调用旧容器命令返回参数错误。
