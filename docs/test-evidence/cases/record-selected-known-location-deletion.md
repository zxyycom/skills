### Case RECORD-SELECTED-KNOWN-LOCATION-DELETION-001: 已知位置缺失可按选择删除

Tests:
- `test:3a5759b0158f12b0628f60a4862798cb3899859c9f1e2ea9eedadbca3a1765fd`
- `test:3d7ed27a8dbc8f22a7661346022083a7e8daf0af93519861725cbe452f4fd98c`

Tags:
- `decision-records`

Contract:
- selected sync 从已知位置处理删除，身份更正须同选旧新 ID。

Proves:
- 共同投影层接纳显式选择的删除和身份更正；DR 集成节点提交已知来源删除，并验证同选旧新后身份与路径。
