### Case DECISION-LIST-ALL-001: List all 返回两种生命周期及完整时间

Tests:
- `test:fcb3e05e67b6b0aea8a13c821a4e81adbc663842d2bf82e288db1bf30823266d`

Tags:
- `decision-records`

Contract:
- `--status all` 返回活动与归档记录及其明确 alignment；`--full-time` 保留完整 `createdAt` 时间戳。

Proves:
- 输出包含两个 ID、active/aligned、archived/unaligned 和两个带时区的 fixture 时间戳，且不含 unknown 或 null。
