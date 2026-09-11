### Case DECISION-LIST-DEFAULT-001: List 默认仅返回活动记录

Tests:
- `test:28bbb053ae9693fc91388d4b34f83d9459523da835c9b2a4d6d0a0d8c2bcc5c9`

Tags:
- `decision-records`

Contract:
- 未指定 `--status` 时，list 读取活动快照，不能混入 archived 记录。

Proves:
- 默认输出包含活动 ID 而不含归档 ID。
