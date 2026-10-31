### Case INVESTIGATION-SYNC-SOURCE-DRIFT-001: 同步保留结束来源复核

Tests:
- `test:a9593738400cfe8bf26a441a4b6f734a50a9a75286ce5e1b51ba8b5b0b4890c4`

Tags:
- `investigation-report`

Contract:
- sync-index 在结束前独立复核来源，期间漂移时保留旧索引并停止写入。

Proves:
- 首次采集后原文变化导致同步 source-drift，索引字节不变且确实重读原文。
