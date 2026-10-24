### Case INVESTIGATION-HISTORY-PAYLOAD-INTEGRITY-001: 无关历史 blob 损坏不阻断所选前序

Tests:
- `test:82e2d8144d6fb0d951715e8032b53113dcf4b1158c90331c86190f817ba45be0`

Tags:
- `investigation-report`

Contract:
- 历史门禁只读取可信索引定位的必要前序，不审计无关 payload。

Proves:
- 破坏无关正式报告 Git object 后，必要前序仍正常确认，不输出历史检查不可用或前序未记录 warning。
