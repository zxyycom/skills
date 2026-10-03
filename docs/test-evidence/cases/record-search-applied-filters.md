### Case RECORD-SEARCH-FILTERS-001: 元信息回显已解析的实际筛选

Tests:
- `test:5cb10aa2be91ed0d03dd68dbdd5c6227b6b4ad5292f30384ed7f5d049c2b63a3`
- `test:6e4762ab466c143ca3990eebda895b69a370b6e0c909c897c93f45ca54192dcd`

Tags:
- `record-search`

Contract:
- 搜索保存实际结构筛选而非重解析 selector；关系目标以同一快照解析的完整 ID 回显，时间以等价 UTC 表达。

Proves:
- Decision 显示完整目标 ID、status/alignment/tags 与精确计数，无返回上限且 metadata 资源/预览为 null。
- Investigation 保留规范化 tags、trim 后文本、等价 UTC 时间与默认 both；实际筛选返回正确关系邻居。
