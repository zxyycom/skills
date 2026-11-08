### Case DECISION-DISCARD-FINAL-INDEX-001: 删除末条保留合法空索引

Tests:
- `test:b03b2ac4a8adc80acda16605b6e7078ee4e2f503f68186b1127493e1053e00a4`

Tags:
- `decision-records`

Contract:
- 删除末条正式记录仍留下可解析且可继续发布的合法空索引。

Proves:
- 删除唯一 active 正式记录后，原生索引 parser 读回空 entries；随后真实 CLI 发布 body-ready 候选成功，读回索引包含该新 ID。本节点不验证 list 输出。
