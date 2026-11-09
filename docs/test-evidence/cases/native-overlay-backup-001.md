### Case NATIVE-OVERLAY-BACKUP-001: 回滚失败时保留原始备份

Tests:
- `test:6c325434cab60448abf640e3c89f486c40034c0e4bab7945e737a870b10b0389`
- `test:fabd43b98815d25f0250e04f530f7be49bb3056f55402401c631c76e7565a55e`

Tags:
- `repository-tooling`

Contract:
- 回滚不能安全完成时保留原始备份并报告路径。

Proves:
- 并发修改及恢复后回读发生 EIO分别导致回滚失败；从诊断取得的备份路径含原始字节，并发更改不被覆盖。
