### Case TASK-GRAPH-RUNTIME-ENGINE-001: Node engine 支持范围边界

Tests:
- `test:3e6c631a0515b274adfa495b23b1987c5d7f2195e31eb8958f6a0e5b07f9f464`

Tags:
- `task-graph`

Contract:
- Mutation runtime 只支持 `^22.22.2 || ^24.15.0 || >=26.0.0`。

Proves:
- 22.22.2、24.15.0 与 26.0.0 及各自后续受支持版本可继续报告 missing；下界之前、奇数 23/25、缺失 patch 和非法版本的 info 查询均返回 `RUNTIME_UNSUPPORTED`。
