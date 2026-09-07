### Case INDEX-RUNTIME-QUERY-001: 过滤决策状态并按稳定标识查找

Tests:
- `test:4b6d314f96708e9e1d2923acdc989d77eda16987b9d3e0fa8221813e17169760`

Tags:
- `index-runtime`

Contract:
- 查询必须按文本、范围和精确条件过滤，并支持稳定标识查找。

Proves:
- 决策索引返回各过滤条件和直接查找对应的唯一状态。
