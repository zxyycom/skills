### Case INDEX-RUNTIME-PERFORMANCE-001: 大状态集合物化与查询在预算内
Entry:
- `tools/index-runtime/tests/performance.test.ts > runtime materializes and queries large state collections within bounds`
- `bun test --test-name-pattern="^runtime materializes and queries large state collections within bounds$" ./tools/index-runtime/tests/run.ts`
Contract:
- Index runtime 的大规模 ID-keyed state 与逐 ID revision 回归必须通过测试内的宽松退化门禁；该门禁不构成持续性能 SLO。
Proves:
- 一千和五千条 keyed state/revision 基准在时间预算内完成并返回正确结果数。
