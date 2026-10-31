### Case DECISION-SET-RELATIONS-REPLACE-001: set-relations 完整替换已建立记录关系并重建索引

Tests:
- `test:01e967c2319fce439a60921fdcfaf66c1fb33bd15b36d15ea2b2396036f2c2ea`
- `test:20a26f5cf5b18ac7019c37baa0aa46e14812ee0fb4f37d12d4ed3b7bc5b72d2d`

Tags:
- `decision-records`

Contract:
- `set-relations` 按 `--source` 分组完整替换已建立记录的直接关系，并在同一事务重建派生索引；完整替换不合并旧关系或旧摘要。

Proves:
- 合法替换后 Markdown 与索引只保留新的 archived 关系及摘要；review 显示 removed 旧关系及完整 before/after，entry 其他字段保持不变。
- 再次替换未提供摘要时旧摘要被移除，review 报告 summary 变化。
