### Case INDEX-RUNTIME-PAGINATION-001: 分页排序结果并保留总数
Entry:
- `tools/index-runtime/tests/query.test.ts > paginates sorted results while preserving the total count`
- `bun test --test-name-pattern="^paginates sorted results while preserving the total count$" ./tools/index-runtime/tests/run.ts`
Contract:
- 分页必须限制当前页条目，同时报告过滤后完整总数。
Proves:
- 偏移一条且限制一条时返回单个条目和总数二。
