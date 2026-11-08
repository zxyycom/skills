### Case DECISION-LIST-ALL-001: List all 包含两种生命周期

Tests:
- `test:26655a9287d408cd499fafc8e9492a3834e06e55501ce449bd9d2552ff49a70e`

Tags:
- `decision-records`

Contract:
- `list --status all` 返回活动和归档记录。

Proves:
- 真实原生 CLI 在含两种状态的索引上执行 `--status all --json`，结果状态同时包含 active 与 archived。旧文本 renderer 的 `--full-time` 格式不属于现行原生输出契约；该节点未断言 alignment 或时间格式。
