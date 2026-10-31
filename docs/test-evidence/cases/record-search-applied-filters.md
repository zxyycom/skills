### Case RECORD-SEARCH-FILTERS-001: 元信息回显已解析的实际筛选

Tests:
- `test:2347375183d480217e9d4b5d2444564a967d12b7b1bb1d365887d04553cedb39`
- `test:3c5fa2d08614b3268f7b34fbae6f1c2c093f5d252d9a7b9d0ea1d3912addada5`

Tags:
- `record-search`

Contract:
- 搜索保存实际结构筛选而非重解析 selector；关系目标以同一快照解析的完整 ID 回显，时间以等价 UTC 表达。

Proves:
- Decision 的真实 metadata 内存投影保留完整目标 ID、status/alignment/tags 与精确计数，默认返回上限为 100 且 metadata 资源/预览为 null。
- Investigation 的真实准备与 metadata 内存投影保留规范化 tags、trim 后文本、等价 UTC 时间与默认 both，实际筛选返回正确关系邻居。
