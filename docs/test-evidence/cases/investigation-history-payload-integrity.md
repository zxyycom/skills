### Case INVESTIGATION-HISTORY-PAYLOAD-INTEGRITY-001: 无关历史 blob 损坏不阻断所选前序

Tests:
- `test:f467bc04e6f2b72ecdc1c3480d17d6639837fff2fce43283fee1cfb6bdc64b4c`

Tags:
- `investigation-report`

Contract:
- 历史门禁只读取可信索引定位的必要前序，不审计无关 payload。

Proves:
- 破坏无关正式报告 Git object 后，必要前序仍正常确认，不输出历史检查不可用或前序未记录 warning。
