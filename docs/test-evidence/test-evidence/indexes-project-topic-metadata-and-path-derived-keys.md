### Case TEST-EVIDENCE-INDEX-TOPIC-PROJECTION-001: 索引投影 Topic Metadata 与路径派生查询字段

Entry:
- `tools/test-evidence/tests/catalog.test.ts > indexes project sorted topic metadata and state-only catalog entries`
- `bun test --test-name-pattern="^indexes project sorted topic metadata and state-only catalog entries$" ./tools/test-evidence/tests/catalog.test.ts`

Contract:
- Schema v4 索引必须按 case ID 键控直接 state，保存已排序 topic metadata，并从每个权威源路径派生唯一精确 topic 查询字段。

Proves:
- 索引使用 definition version 4 与 schema version 4，entries 与逐 case revision 拥有相同 ID 集合。
- Topic 顺序和 `<topic>/<slug>.md` 源路径形成一致投影，topic 不在 state 中重复保存。
