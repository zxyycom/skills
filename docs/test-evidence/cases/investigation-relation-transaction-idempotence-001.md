### Case INVESTIGATION-RELATION-TRANSACTION-IDEMPOTENCE-001: 无变化关系准备仍核对来源

Tests:
- `test:bfeb56dfc2efab1323f5d832e4d5c213155437c4bdfd7b2334f716c55a48e279`

Tags:
- `investigation-report`

Contract:
- 无关系变化的准备不写来源、保留索引投影，但仍拒绝与索引修订不匹配的来源。

Proves:
- unchanged review 产生空 edits 并保持索引状态；相同 review 传入已漂移正文时返回 StaleSource。
