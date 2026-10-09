### Case CHANGE-PLAN-QUERY-HISTORY-REUSE-001: 集合查询复用 Git 历史但独立计算 Change 排除

Tests:
- `test:62f9e5814d0a36ff6d09188ab3473a8b515b730f0927055fcf4d7bf1e1b4d202`

Tags:
- `change-plan`
- `performance`

Contract:
- list 与 check-all 在单次查询中复用同仓库、同基线的 HEAD 和 first-parent 历史；每个 Change 的目录外提交和行数仍按自己的路径独立计算。

Proves:
- 对二十个共享基线的 Plan，真实 Git trace 记录四次调用：仓库发现、HEAD 查询、基线解析和历史扫描各一次；list 与 check-all 均满足该调用边界。
- 混合路径提交与空提交下，每项结果与独立 checker 一致；被修改 Change 排除自己的两行，其他 Change 将这两行计入目录外变化，空提交仍计数。
