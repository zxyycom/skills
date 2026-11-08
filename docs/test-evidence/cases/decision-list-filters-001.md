### Case DECISION-LIST-FILTERS-001: 决策列表按生命周期、标签与对齐状态筛选

Tests:
- `test:26655a9287d408cd499fafc8e9492a3834e06e55501ce449bd9d2552ff49a70e`

Tags:
- `decision-records`

Contract:
- List 从持久索引按生命周期、AND 标签和对齐状态选择记录；使用标签选择器。

Proves:
- 真实原生 CLI 对持久索引组合 active、unaligned 和两个 tag，仅返回同时满足全部条件的记录；archived/aligned 组合成功返回空集。
