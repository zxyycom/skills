### Case DECISION-SEARCH-FALLBACK-001: Decision search 以只读来源投影处理陈旧索引

Entry:
- `tools/decision-records/tests/queries.test.ts > decision search falls back to a read-only validated source projection`
- `bun test --test-name-pattern="^decision search falls back to a read-only validated source projection$" ./tools/decision-records/tests/run.ts`

Contract:
- 搜索遇到陈旧 Decision 索引时，必须从已验证来源建立只读投影完成 sourcePath 到 ID 的反查，而不写回索引。

Proves:
- 索引未收录的新正文词仍返回现有 Decision ID。
- stderr 报告只读来源投影，且持久索引字节保持不变。
