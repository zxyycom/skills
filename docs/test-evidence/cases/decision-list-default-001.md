### Case DECISION-LIST-DEFAULT-001: List 默认仅返回活动记录

Tests:
- `test:5d8904e641d4f9f75418d1409447be1c7f13bbeff272ca5a31b225b67ce198ab`

Tags:
- `decision-records`

Contract:
- 未指定 `--status` 时，list 读取活动快照，不能混入 archived 记录。

Proves:
- 默认输出包含活动 ID 而不含归档 ID。
