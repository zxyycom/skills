### Case DECISION-SYNC-FINAL-REVISION-GUARD-001: 同步结束独立检查来源漂移

Tests:
- `test:33bde5655ecf6e9db4235920d644f19a5b5acf7b3de6cfea4f5c338f4aae01a2`

Tags:
- `decision-records`

Contract:
- 同步构建快照后必须独立获取来源 revision；期间漂移时拒绝写入索引。

Proves:
- 首次读取后改写真实文件，结束检查再次读取并报告 state-index.source-changed；changed 为 false，索引文件不存在。
