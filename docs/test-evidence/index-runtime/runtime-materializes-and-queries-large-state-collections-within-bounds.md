### Case INDEX-RUNTIME-PERFORMANCE-001: 大状态集合物化与查询在预算内
Entry:
- `tools/index-runtime/tests/performance.test.ts > runtime materializes and queries large state collections within bounds`
- `bun test --test-name-pattern="^runtime materializes and queries large state collections within bounds$" ./tools/index-runtime/tests/run.ts`
Contract:
- Index runtime 对大规模状态集合的物化和查询必须保持在既定性能边界内。
Proves:
- 基准规模在时间预算内完成并返回正确结果数。
