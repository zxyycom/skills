### Case TEST-EVIDENCE-INDEX-TOPIC-PROJECTION-001: 索引投影 Topic Metadata 与路径派生键
Entry:
- `tools/test-evidence/tests/run.ts > indexes project sorted topic metadata and path-derived topic keys`
- `bun test --test-name-pattern="^indexes project sorted topic metadata and path-derived topic keys$" ./tools/test-evidence/tests/run.ts`
Contract:
- v3 索引必须保存已排序 topic metadata，并从每个权威源路径派生唯一精确 topic 键。
Proves:
- 索引 definition version、topic 顺序、每项 topic 键和 `<topic>/<slug>.md` 源路径形成一致投影。
