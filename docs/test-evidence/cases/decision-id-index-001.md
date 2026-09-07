### Case DECISION-ID-INDEX-001: State-only ID 键索引

Tests:
- `test:8ec9a6d510509f1e1ffb8e33d6665c728761b2a8cd5ccbb1d1b489bab100d2dc`

Tags:
- `decision-records`

Contract:
- 索引 entries 和 sourceRevision 必须以稳定 Decision ID 为键，metadata 为空对象；entry 直接持久化领域 state，查询字段由 definition 提供。

Proves:
- fixture 的 schema/definition version、ID 顺序、sourcePath 与 tags state 投影均精确匹配。
