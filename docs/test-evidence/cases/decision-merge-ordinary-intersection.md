### Case DECISION-MERGE-ORDINARY-INTERSECTION-001: 归并事件 direct 集合包含事件内普通邻居

Tests:
- `test:abb4e7a64a41419906063907d31200bb1eee5f42024dd6dd7724e79f61524e64`

Tags:
- `decision-records`

Contract:
- 事件的 direct 集合是当前方向全部邻居与事件成员交集，不限触发事件的同类型边。

Proves:
- m→p1,p2 归并加 p1→p2 普通边，从 p2 查询 successors 时 m/p1 均为 trace，不把 p1 留在 context，深度 frontier 精确保留。
