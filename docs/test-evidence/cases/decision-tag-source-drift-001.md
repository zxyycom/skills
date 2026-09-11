### Case DECISION-TAG-SOURCE-DRIFT-001: Check 检测标签来源漂移并由同步接受

Tests:
- `test:54b2bdb5726aa8a94e675cc7548bd72da78c6beb002ac2aee85e54ee5ede2694`

Tags:
- `decision-records`

Contract:
- 标签来源漂移使 strict check 失败；sync-index 重建后接受当前来源。

Proves:
- 添加 tag 后 check 非零，随后同步索引成功。
