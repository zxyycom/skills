### Case DECISION-EVOLVE-DISCARD-RECORDED-001: Evolve discard 在删除已记录决策前暂停

Tests:
- `test:9646502e27b4ca50ef6771dcd618fe1646d8bed7bcd1d5791456a7cffcdded1c`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 删除已进入 Git `HEAD` 的 Decision ID 时，未带 `--delete-recorded-decision` 必须 attention 且零写入。

Proves:
- 后继候选、删除目标和派生索引在 attention 后保持不变。
