### Case DECISION-ID-INDEX-001: State-only ID 键索引

Tests:
- `test:20bec216e67ab786d17e83fcc0ea692eccc87af49d5a6fd1dd77bf9087af364e`

Tags:
- `decision-records`

Contract:
- 索引 entries 和 sourceRevision 必须以稳定 Decision ID 为键，metadata 为空对象；entry 直接持久化包含明确 alignment 的领域 state，查询字段由 definition 11 提供。

Proves:
- 内存 Markdown snapshot 经真实索引构建器生成 schemaVersion 4、namespace decisions、definitionVersion 11 和空 metadata；entries 与 sourceRevision 的 ID 键顺序、当前记录的 sourcePath 与 tags 均精确匹配。
