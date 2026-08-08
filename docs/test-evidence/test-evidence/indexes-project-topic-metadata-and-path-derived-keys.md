### Case TEST-EVIDENCE-INDEX-TOPIC-PROJECTION-001: 索引投影 Topic Metadata 与路径派生键

Entry:
- `tools/test-evidence/tests/run.ts > indexes project sorted topic metadata and path-derived topic keys`
- `bun test --test-name-pattern="^indexes project sorted topic metadata and path-derived topic keys$" ./tools/test-evidence/tests/run.ts`

Contract:
- Schema v3 索引必须按 case ID 键控 stored entries，保存已排序 topic metadata，并从每个权威源路径派生唯一精确 topic 键。

Proves:
- 索引使用 definition version 3 与 schema version 3，stored entry 不重复保存通用 ID，且 entries 与逐 case revision 拥有相同 ID 集合。
- Topic 顺序、每项 topic 键和 `<topic>/<slug>.md` 源路径形成一致投影。
