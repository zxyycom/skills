# Index Runtime

### Case INDEX-RUNTIME-MATERIALIZATION-001: 索引物化确定且执行新鲜度检查
Entry:
- `tools/index-runtime/tests/materialization.test.ts > materialization builds deterministic indexes and enforces freshness`
- `bun test --test-name-pattern="^materialization builds deterministic indexes and enforces freshness$" ./tools/index-runtime/tests/run.ts`
Contract:
- 相同状态集合必须物化为确定索引，并按源摘要判断新鲜度。
Proves:
- 重复构建结果一致，源状态变化会标记旧索引。

### Case INDEX-RUNTIME-PERFORMANCE-001: 大状态集合物化与查询在预算内
Entry:
- `tools/index-runtime/tests/performance.test.ts > runtime materializes and queries large state collections within bounds`
- `bun test --test-name-pattern="^runtime materializes and queries large state collections within bounds$" ./tools/index-runtime/tests/run.ts`
Contract:
- Index runtime 对大规模状态集合的物化和查询必须保持在既定性能边界内。
Proves:
- 基准规模在时间预算内完成并返回正确结果数。

### Case INDEX-RUNTIME-PROTOCOL-001: 协议定义验证 key、state 与 metadata
Entry:
- `tools/index-runtime/tests/protocol.test.ts > protocol definitions validate keys, states, and metadata`
- `bun test --test-name-pattern="^protocol definitions validate keys, states, and metadata$" ./tools/index-runtime/tests/run.ts`
Contract:
- 索引协议必须验证 key 定义、状态结构和 metadata Schema。
Proves:
- 合法定义可构建，冲突或无效协议产生明确错误。

### Case INDEX-RUNTIME-QUERY-001: 查询支持筛选、排序、分页与合并
Entry:
- `tools/index-runtime/tests/query.test.ts > queries filter, sort, paginate, and merge runtime states`
- `bun test --test-name-pattern="^queries filter, sort, paginate, and merge runtime states$" ./tools/index-runtime/tests/run.ts`
Contract:
- 索引查询必须组合筛选、排序、分页及 runtime state 覆盖语义。
Proves:
- 组合查询返回稳定顺序、正确总数和合并后的状态。

### Case INDEX-RUNTIME-PERSISTENCE-001: Runtime 打开、同步并恢复持久化索引
Entry:
- `tools/index-runtime/tests/runtime.test.ts > runtime opens, synchronizes, and recovers persisted indexes`
- `bun test --test-name-pattern="^runtime opens, synchronizes, and recovers persisted indexes$" ./tools/index-runtime/tests/run.ts`
Contract:
- Runtime 必须打开当前索引、同步写入并从可恢复漂移回退。
Proves:
- 正常、缺失、过期和损坏索引路径返回约定状态与诊断。
