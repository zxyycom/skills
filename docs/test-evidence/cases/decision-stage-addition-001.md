### Case DECISION-STAGE-ADDITION-001: 单选新 ID 表达 addition 而非改名

Tests:
- `test:eb3c4c007ccec71604d756b70d4dc14186da5e5d12245117d42d2f5d6f4a655d`

Tags:
- `decision-records`

Contract:
- 单选 new ID 只能表达 addition，工具不从磁盘差异推断 rename。

Proves:
- 真实 stage 暂存 added 正文，同时保留未选 old 的原 pending 正文。
