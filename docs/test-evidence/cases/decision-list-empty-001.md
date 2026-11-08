### Case DECISION-LIST-EMPTY-001: List 对无匹配 tag 或 alignment 返回空结果

Tests:
- `test:26655a9287d408cd499fafc8e9492a3834e06e55501ce449bd9d2552ff49a70e`

Tags:
- `decision-records`

Contract:
- 不匹配的 tag 或 alignment 是成功的空查询，不得返回无关记录。

Proves:
- 真实原生 CLI 对不存在的 tag 和无匹配的 archived/aligned 组合均成功返回空 `records`；此节点不检查旧文本 `none` 呈现。
