### Case INVESTIGATION-INDEX-QUERY-001: 索引查询筛选并分页调查状态
Entry:
- `tools/investigation-report/tests/index-query.test.ts > index queries return filtered and paginated investigation states`
- `bun test --test-name-pattern="^index queries return filtered and paginated investigation states$" ./tools/investigation-report/tests/run.ts`
Contract:
- Schema v3 调查索引必须按报告路径键控 state/revision，并继续支持状态筛选、稳定排序和分页。
Proves:
- Stored entry 不重复保存 ID，entries 与 revision 成员一致；查询返回正确 total、offset 和目标报告集合。
