### Case INVESTIGATION-INDEX-QUERY-001: 索引查询返回 v5 主题状态并要求空 Metadata

Entry:
- `tools/investigation-report/tests/index-query.test.ts > index queries return v5 topic states with strict empty metadata`
- `bun test --test-name-pattern="^index queries return v5 topic states with strict empty metadata$" ./tools/investigation-report/tests/run.ts`

Contract:
- Schema v3、definition version 5 的调查索引按主题路径键控 state 与 revision，metadata 是严格的空对象，并继续支持状态筛选、稳定排序和分页。

Proves:
- 索引 entries 与 revision 成员一致，state 资源引用为空，metadata 为 `{}`。
- 公共查询按状态和文本条件返回正确的 total、offset 与目标主题。
