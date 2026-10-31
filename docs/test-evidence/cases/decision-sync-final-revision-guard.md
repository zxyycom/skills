### Case DECISION-SYNC-FINAL-REVISION-GUARD-001: 同步结束独立检查来源漂移

Tests:
- `test:124ab5aa4afa69921362354beca425a6558bfcb6d4b78f9e2448253daf1a40d5`

Tags:
- `decision-records`

Contract:
- 同步构建快照后必须独立获取来源 revision；期间漂移时拒绝写入索引。

Proves:
- 首次读取后改写真实文件，结束检查再次读取并报告 state-index.source-changed；changed 为 false，索引文件不存在。
