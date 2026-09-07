### Case DECISION-EVOLVE-DISCARD-RECORDED-001: Evolve discard 在删除已记录决策前暂停

Tests:
- `test:6a15b9fd779b2401268bc6fa0a27c5e141167fd6f79a88432e10b8e00f0ffe4e`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 删除已进入 Git `HEAD` 的 Decision ID 时，未带 `--delete-recorded-decision` 必须 attention 且零写入。

Proves:
- 后继候选、删除目标和派生索引在 attention 后保持不变。
