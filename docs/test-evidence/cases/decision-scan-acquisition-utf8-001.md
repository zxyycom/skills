### Case DECISION-SCAN-ACQUISITION-UTF8-001: 首次采集拒绝来源和索引的非法UTF-8

Tests:
- `test:504235141f29d4ce4b2ba006066edab58153d85e1cfe2cb30bea20ab4f1236b0`

Tags:
- `decision-records`

Contract:
- 全量check的首次采集用安全handle读取严格UTF-8，读取失败不冒充合法空来源。

Proves:
- 将来源或索引替换为非法UTF-8字节后，scan明确报告对应读失败，来源标为invalid或索引不可解析。
