### Case DECISION-BODY-EMPTY-001: 决策正文字段值必须同行非空

Tests:
- `test:8ce1fc1b8d1c9ca171604664041ffbf4c585c7fe1d3b2898baaef6c31d0f69c8`

Tags:
- `decision-records`

Contract:
- 决策正文中的必填 `采用` 值必须与字段标签位于同一行，并在去除首尾空白后保持非空。

Proves:
- 六种标记与冒号组合的空串、空白和下一行值均不 ready，且报告包含 `采用` 的字段错误。
