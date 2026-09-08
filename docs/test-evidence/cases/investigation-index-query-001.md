### Case INVESTIGATION-INDEX-QUERY-001: List 按近期时间与 ID tie-break 排序并组合 AND tags

Tests:
- `test:dcb4f23f6e92ea055ce7b8d2b0ca897f63d83c39a4d222853d927a26e585316a`

Tags:
- `investigation-report`

Contract:
- 报告 list 按 formedAt instant 倒序排列，时间相同时用 Investigation ID 升序稳定打破平局；重复 tag 条件使用 AND。

Proves:
- 两个 tag 条件只返回同时具有两者的报告，最新报告在前，相同形成时间的两项按 ID 升序。
