### Case VIDEO-WRITER-CLEANUP-001: 独占写入和清理保护唯一有效快照

Tests:
- `test:28dd59415730f6991db0ede41aa8432179b098903919deaa4ab6376f43d5614a`
- `test:30e52a56cf4ca306f9b46cfedd901a4d5e2d99d3713ecf7ed01810f6fb5ba7a3`
- `test:324d3eb9e6c6762c0e382b29d86b661e941bc72a52fcef75be55f0353050b7e8`
- `test:46a0bd6a9425bd27741d772a9437ad161f708facc1ebcd0ca2a91e2c0dc2ac1b`
- `test:83d13af581d0dc33a17473a86ec8f451980d33dc0708f64ca92a63c6bcfd6a32`
- `test:9d2ec75785fa343942134c602a67fec0d1efe47723a40c3f9963d871c5e3c669`
- `test:ffcc499c0eb9928024551ff80e9e333785d861a64241e07bd5c59751a4c04cb0`

Tags:
- `video-understanding`

Contract:
- 证据写入由独占 writer 和原子发布保护；清理失败必须可观察，未发布材料不改变有效快照。

Proves:
- 发布、锁移除和句柄关闭失败被分层报告；已有主错误保留身份，竞争 writer 不写入，显式空重建获得新 scope。
