### Case INVESTIGATION-INDEX-QUERY-001: List 按近期时间与 ID tie-break 排序并组合 AND tags

Tests:
- `test:983c40e1ba7119f4e2a9345e566710ccdc6525c8f0d0bad53da78a6a94ce9b54`

Tags:
- `investigation-report`

Contract:
- 报告 list 按 formedAt instant 倒序排列，时间相同时用 Investigation ID 升序稳定打破平局；重复 tag 条件使用 AND。

Proves:
- 两个 tag 条件只返回同时具有两者的报告，最新报告在前，相同形成时间的两项按 ID 升序。
