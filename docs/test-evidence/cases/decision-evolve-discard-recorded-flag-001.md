### Case DECISION-EVOLVE-DISCARD-RECORDED-FLAG-001: Evolve discard 参数删除已记录决策而不读取 Git HEAD

Tests:
- `test:d957b2aca2874115e422f9b039bd3619bc054ef4c205772081981513be5585ee`

Tags:
- `decision-records`

Contract:
- `evolve --discard` 带 `--delete-recorded-decision` 时，该参数是删除目标的机械确认，不为 discard 自身重复读取 Git `HEAD`。

Proves:
- 删除目标已进入 Git HEAD 且 HEAD 随后不可读取时，来源关系为空的新 candidate 仍在同一事务建立，目标被删除。
