### Case INDEX-RUNTIME-PAGINATION-001: 分页排序结果并保留总数

Tests:
- `test:abff6a831e16914d8b1acbc22d31ded25dbaf920e09fdd6d491bef8ff2ff6a6d`

Tags:
- `index-runtime`

Contract:
- 分页必须限制当前页条目，同时报告过滤后完整总数。

Proves:
- 偏移一条且限制一条时返回单个条目和总数二。
