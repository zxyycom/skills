### Case DECISION-STAGE-ADDITION-001: 单选新 ID 表达 addition 而非改名

Tests:
- `test:7edba468217e7bf0bce3d62a8defd0676a6b0b97c2ca003ce7d8568f423ed79f`

Tags:
- `decision-records`

Contract:
- 单选 new ID 只能表达 addition，工具不从磁盘差异推断 rename。

Proves:
- pending index 同时保留未选择的 old ID 与新增 ID。
