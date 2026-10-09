### Case CHANGE-PLAN-QUERY-SHARED-FAILURES-001: 查询复用保留每项 Plan 的失败诊断

Tests:
- `test:f40c4b12ce9516576d9404f9a0b10641bb3d52786b45eb807fb659756d144a33`

Tags:
- `change-plan`

Contract:
- 每个受检 Plan 都必须保留自己的基线不可用或版本控制失败诊断；共享查询失败不能变成合法空距离或根级集合错误。

Proves:
- 两个共享不存在基线的 Plan 都无效且各自返回 base-commit-unavailable，根级 errors 为空。
- 将 HEAD 所指 ref 写成损坏内容后，同一进程的新查询中两个 Plan 都无效且各自返回 version-control-failed，根级 errors 仍为空。
