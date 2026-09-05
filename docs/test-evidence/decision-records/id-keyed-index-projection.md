### Case DECISION-ID-INDEX-001: State-only ID 键索引

Entry:
- `tools/decision-records/tests/layout-index.test.ts > decision index is state-only and ID-keyed with empty metadata`
- `bun test --test-name-pattern="^decision index is state-only and ID-keyed with empty metadata$" ./tools/decision-records/tests/run.ts`

Contract:
- 索引 entries 和 sourceRevision 必须以稳定 Decision ID 为键，metadata 为空对象；entry 直接持久化领域 state，查询字段由 definition 提供。

Proves:
- fixture 的 schema/definition version、ID 顺序、sourcePath 与 tags state 投影均精确匹配。
