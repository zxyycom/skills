### Case DECISION-SET-RELATIONS-REPLACE-001: set-relations 完整替换已建立记录关系并重建索引

Tests:
- `test:c84710f358f2a49729a026234b015d69bb75635b122d241b6a8ef0d515ebab17`
- `test:d4e40a307aa628dfac35e51ff2cc4bfae79cba1e0affa7e4d59a9d9b8a7980b8`

Tags:
- `decision-records`

Contract:
- `set-relations` 按 `--source` 分组完整替换已建立记录的直接关系，并在同一事务重建派生索引；完整替换不合并旧关系或旧摘要。

Proves:
- 合法替换后 Markdown 与索引只保留新的 archived 关系及摘要；review 显示 removed 旧关系及完整 before/after，entry 其他字段保持不变。
- 再次替换未提供摘要时旧摘要被移除，review 报告 summary 变化。
