### Case TASK-GRAPH-RUNTIME-ENGINE-001: Node engine 在安装状态前失败关闭

Tests:
- `test:3e6c631a0515b274adfa495b23b1987c5d7f2195e31eb8958f6a0e5b07f9f464`
- `test:f507b83bf25b748b5b8c9681b4e2f8f923d89089d7e6d881034759840fb857d1`

Tags:
- `task-graph`

Contract:
- Mutation runtime 只支持 `^22.22.2 || ^24.15.0 || >=26.0.0`。

Proves:
- 不受支持的 Node 在 info 和 mutation binding 加载中都先返回 `RUNTIME_UNSUPPORTED`，不会把缺失目录误报为安装问题。
- 22.22.2、24.15.0 与 26.0.0 及各自后续受支持版本可继续报告 missing；下界之前、奇数 23/25、缺失 patch 和非法版本都拒绝。
