### Case DECISION-ID-INDEX-001: ID 键索引与确定标签键

Entry:
- `tools/decision-records/tests/layout-index.test.ts > decision index is ID-keyed with empty metadata and deterministic tag keys`
- `bun test --test-name-pattern="^decision index is ID-keyed with empty metadata and deterministic tag keys$" ./tools/decision-records/tests/run.ts`

Contract:
- 索引 entries 和 sourceRevision 必须以稳定 Decision ID 为键，metadata 为空对象，并定义 tag/status/alignment 精确键。

Proves:
- fixture 的 definitionVersion、keyDefinitions、ID 顺序、sourcePath 与 tags 投影均精确匹配。
