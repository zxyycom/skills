### Case DECISION-LIST-TAG-AND-001: List 对重复标签采用 AND 筛选

Tests:
- `test:dfefe87d13b7da79839791cdc6e3583be7312ff7daad4e21b156adce1af0f76a`

Tags:
- `decision-records`

Contract:
- 重复 `--tag` 选择器必须取交集，而不是并集。

Proves:
- A、A+B、B 三条记录中，双 tag 仅返回 A+B。
