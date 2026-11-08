### Case DECISION-LIST-DEFAULT-001: List 默认仅返回活动记录

Tests:
- `test:8e76252f8d2c9ff5f841379f60ea88d5eeb524d5495aaf1b42cdb9863e926a57`

Tags:
- `decision-records`

Contract:
- 未指定 `--status` 时，list 读取活动快照，不能混入 archived 记录。

Proves:
- 真实原生 CLI 在同时含活动与归档记录的索引上不传 status，JSON records 仅含活动 ID。
