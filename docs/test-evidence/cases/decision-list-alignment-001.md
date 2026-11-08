### Case DECISION-LIST-ALIGNMENT-001: List 按 alignment 筛选

Tests:
- `test:26655a9287d408cd499fafc8e9492a3834e06e55501ce449bd9d2552ff49a70e`

Tags:
- `decision-records`

Contract:
- alignment 选择器必须从持久索引返回对应状态。

Proves:
- 真实原生 CLI 在 active、unaligned 与两个 tag 的交集上仅返回 unaligned 目标；archived/aligned 同 tags 的组合成功返回空集。
