### Case DECISION-SCAN-ACQUISITION-UTF8-001: 首次采集拒绝来源和索引的非法UTF-8

Tests:
- `test:53b65214f663e21cce0b88985a3e2eb498665adda5ec4d1bafebbd2bcb8fec85`

Tags:
- `decision-records`

Contract:
- 全量check的首次采集用安全handle读取严格UTF-8，读取失败不冒充合法空来源。

Proves:
- 将来源或索引替换为非法UTF-8字节后，scan明确报告对应读失败，来源标为invalid或索引不可解析。
