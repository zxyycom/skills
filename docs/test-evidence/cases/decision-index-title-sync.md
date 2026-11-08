### Case DECISION-INDEX-TITLE-SYNC-001: 标题更新需显式同步

Tests:
- `test:6aa14cc7d926e585704b7ce7b4c525c446e24d79d3a9b8c9e675e43eca83ecb8`

Tags:
- `decision-records`

Contract:
- 标题手改后 list 沿用已发布投影，显式 sync-index 后才更新。

Proves:
- 真实 CLI 在标题改动前后返回旧标题且索引字节保持；全量同步后返回新标题，status、alignment、createdAt 与 sourcePath 保持。
