### Case TASK-GRAPH-RUNTIME-ENGINE-001: Node engine 在安装状态前失败关闭

Tests:
- `test:f507b83bf25b748b5b8c9681b4e2f8f923d89089d7e6d881034759840fb857d1`

Tags:
- `task-graph`

Contract:
- Mutation runtime 只支持 `^22.22.2 || ^24.15.0 || >=26.0.0`。

Proves:
- 不受支持的 Node 在 info 和 mutation binding 加载中都先返回 `RUNTIME_UNSUPPORTED`，不会把缺失目录误报为安装问题。
