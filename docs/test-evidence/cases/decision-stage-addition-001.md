### Case DECISION-STAGE-ADDITION-001: 单选新 ID 表达 addition 而非改名

Tests:
- `test:0307b5fde914ec6a605bfce5b28a71ca988633cc6805d57833e6b4c19ec77639`

Tags:
- `decision-records`

Contract:
- 单选 new ID 只能表达 addition，工具不从磁盘差异推断 rename。

Proves:
- pending index 同时保留未选择的 old ID 与新增 ID。
