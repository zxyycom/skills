### Case TEST-EVIDENCE-CORE-SCALE-001: 索引 Case 筛选在规模下保持精确排序与分页

Tests:
- `test:ab127d35d855861bdb20c52eb87be2a6aef104a45d94ac7ea3d4d27db1c74dec`

Tags:
- `test-evidence`

Contract:
- Case 索引的 tag 条件按 AND 相交，test ID 精确匹配，结果按 ID 词法排序并在分页后保持完整 total。

Proves:
- 1,000 个生成 Case 仍返回 tag AND、精确 test、词法排序和 offset/limit 的预期结果。
