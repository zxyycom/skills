### Case INVESTIGATION-INDEX-QUERY-001: 索引查询筛选并分页调查状态
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index queries return filtered and paginated investigation states`
- `bun test --test-name-pattern="^index queries return filtered and paginated investigation states$" ./tools/investigation-report/tests/run.ts`
Contract:
- 调查索引查询必须支持状态筛选、稳定排序和分页。
Proves:
- 查询返回正确 total、offset 和目标报告集合。
