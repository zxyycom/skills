### Case DECISION-EVOLVE-DISCARD-RECORDED-001: Evolve discard 在删除已记录决策前暂停

Tests:
- `test:9109869a5094b2240c8b089cf150f7b372f9c15cbc75693355d687bba15b3242`

Tags:
- `decision-records`

Contract:
- evolve discard 对已记录集合中的删除目标，未带 delete-recorded 时必须 attention，且不能生成 mutation changes 或成功 relationReview。

Proves:
- 真实 Git 基线中的原生 evolve 预检返回 `history-confirmation`，标识目标并提示 `--delete-recorded`，被选旧来源字节保持。该节点不覆盖 CLI 退出码或 renderer。
