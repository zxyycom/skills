### Case INVESTIGATION-SYNC-SOURCE-DRIFT-001: 同步保留结束来源复核

Tests:
- `test:dcb93a5292937f33cf4480f2a900361b1d47cb5fef93ef2abb971a284cb17937`

Tags:
- `investigation-report`

Contract:
- sync-index 在结束前独立复核来源，期间漂移时保留旧索引并停止写入。

Proves:
- 首次采集后原文变化导致同步 source-drift，索引字节不变且确实重读原文。
