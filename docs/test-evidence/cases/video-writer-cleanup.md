### Case VIDEO-WRITER-CLEANUP-001: 独占写入和清理保护唯一有效快照

Tests:
- `test:06600f924ad2e1b62874ba3bc82472a6bf83a7fc0bec93ea2518340dff3ed737`
- `test:6c9ba952be6a009100fe9c878ce9319c6b40c3226cdf355891ddd6f4e89660a8`
- `test:a05f54eb9b22d8a475d5da37981a5f63591a96105d1f4f60f21ceb83d229ff6d`
- `test:d7a90a03215af88cbe038946dde3e0a8e67d0aee3b8d0fe697fda4b1912f7b31`
- `test:d83e750028b5417ffd063a63ff816ec27a2fe84656847ec607abf3c342ae33c4`
- `test:ee669f002feb9fe804881fb55a64758dbff966dadfb7ba6254a9ac68e8eb51dd`
- `test:f18bc53aa0a087328fcebb5579da07edb79f04bd31e48a3dd85857086ff95e4a`

Tags:
- `video-understanding`

Contract:
- 证据写入由独占 writer 和原子发布保护；清理失败必须可观察，未发布材料不改变有效快照。

Proves:
- 发布、锁移除和句柄关闭失败被分层报告；已有主错误保留身份，竞争 writer 不写入，显式空重建获得新 scope。
