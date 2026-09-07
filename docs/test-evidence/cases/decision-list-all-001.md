### Case DECISION-LIST-ALL-001: List all 返回两种生命周期及完整时间

Tests:
- `test:b3b600178f54af4d4f842ec619e35f63c2dec529a7e5e071ed203736994bf794`

Tags:
- `decision-records`

Contract:
- `--status all` 返回活动与归档记录；`--full-time` 保留完整 `createdAt` 时间戳。

Proves:
- 输出包含两个 ID 和两个带时区的 fixture 时间戳。
