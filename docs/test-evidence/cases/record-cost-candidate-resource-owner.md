### Case RECORD-COST-CASE-016: 候选资源归属

Tests:
- `test:b79782dcec5928dd23d726da926624b0ec343b116c6db8b9b9fd46b0458fc99e`

Tags:
- `record-cost`

Contract:
- 候选 owner 资源匹配完整 ID，不得按名称前缀归属给另一个候选。

Proves:
- 非 Git 工作区包含同日期 one 与 one-more 两个候选，只有后者 owner 目录有未引用资源；前者 resourceReady，后者不 ready。本节点不覆盖根级异常资源或 Git warning 排序。
