### Case DECISION-SCAN-ACQUISITION-UTF8-001: 全量采集拒绝来源非法 UTF-8

Tests:
- `test:876f7605ffddd4b33d5c9ae5808e14c1a2001ccc30ce6d7d730e437f28efe96d`

Tags:
- `decision-records`

Contract:
- 严格 check 和 full sync 不能将非法 UTF-8 来源视为空集合。

Proves:
- 真实 CLI 对同一合法来源的 check/full sync 先成功；替换为非法 UTF-8 后均以编码类诊断失败，索引字节不变。
